const { hubspotRequest } = require('./lib/hubspot.js');
const { calculateRenewalRisk } = require('./lib/renewal-score.js');
const { claimWebhookEvent, claimAssociationTransition, releaseAssociationTransition, releaseWebhookEvent } = require('./lib/token-store.js');
const SCORE_OBJECT_TYPE = '1-12815455';
const APP_ID = '45236293';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const events = Array.isArray(req.body) ? req.body : [];
    console.log(`[webhook] Renewal Radar scorer v1 received ${events.length} event(s).`);
    console.log(`[webhook] Raw payload: ${JSON.stringify(events)}`);
    for (const event of events) {
      console.log(`[webhook] Event ${event.subscriptionType} for ${event.objectType || event.objectTypeId || 'unknown'} ${event.objectId}.`);
      if (event.subscriptionType === 'object.associationChange') {
        console.log(`[webhook] Association fields: ${JSON.stringify({
          objectId: event.objectId,
          objectType: event.objectType,
          objectTypeId: event.objectTypeId,
          fromObjectId: event.fromObjectId,
          toObjectId: event.toObjectId,
          fromObjectTypeId: event.fromObjectTypeId,
          toObjectTypeId: event.toObjectTypeId,
          associationType: event.associationType,
          associationTypeId: event.associationTypeId,
          associationRemoved: event.associationRemoved,
        })}`);
      }
    }
    await Promise.all(events.map(recalculateForEvent));
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook] Recalculation failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

async function recalculateForEvent(event) {
  // eventId alone is not guaranteed unique. Include the subscription, object,
  // timestamp, and association identifiers so retries are ignored without
  // collapsing separate association changes into one score update.
  const deliveryKey = [
    event.subscriptionId,
    event.eventId,
    event.subscriptionType,
    event.objectId,
    event.occurredAt || event.createdAt || event.label,
    event.fromObjectTypeId,
    event.toObjectTypeId,
    event.fromObjectId,
    event.toObjectId,
    event.associationTypeId,
    event.associationRemoved,
    event.propertyName,
    event.propertyValue,
  ].join(':');
  if (!(await claimWebhookEvent(event.portalId, deliveryKey))) {
    console.log(`[webhook] Ignored duplicate event ${deliveryKey}.`);
    return;
  }

  try {
    const dealCompanyAssociation = getDealCompanyAssociation(event);
    if (dealCompanyAssociation) {
      const { companyId, dealId, removed } = dealCompanyAssociation;
      const occurredAt = event.occurredAt || event.createdAt || event.label || event.eventId;
      if (!(await claimAssociationTransition(event.portalId, companyId, dealId, removed, occurredAt))) {
        console.log(`[webhook] Ignored duplicate Deal-to-Company association transition for Deal ${dealId}.`);
        return;
      }
      try {
        await recalculateCompany(event.portalId, companyId, {
          ...event,
          renewalAction: removed ? 'association-removed' : 'association-added',
        });
      } catch (error) {
        await releaseAssociationTransition(event.portalId, companyId, dealId, removed, occurredAt);
        throw error;
      }
      return;
    }

    const dealEvent = isDealWebhookEvent(event);
    const objectType = isTicketEvent(event) ? 'tickets' : 'deals';

    let companyIds;
    if (event.subscriptionType === 'object.associationChange') {
      console.log('[webhook] Ignored association change that does not involve a Deal and a Company.');
      return;
    } else {
      const companies = await hubspotRequest(event.portalId, `/crm/v4/objects/${objectType}/${event.objectId}/associations/companies`);
      companyIds = (companies.results || []).map(({ toObjectId }) => String(toObjectId));
    }

    if (!companyIds.length) {
      console.log(`[webhook] No associated company was available for ${event.objectType || event.objectTypeId} ${event.objectId}.`);
      return;
    }
    await Promise.all(companyIds.map((companyId) => recalculateCompany(event.portalId, companyId, event)));
  } catch (error) {
    // Leave failed deliveries eligible for HubSpot's retry rather than losing points.
    await releaseWebhookEvent(event.portalId, deliveryKey);
    throw error;
  }
}

async function recalculateCompany(portalId, companyId, event) {
  console.log(`[webhook] Recalculating Company ${companyId}.`);
  const [tickets, deals] = await Promise.all(['tickets', 'deals'].map((type) => hubspotRequest(portalId, `/crm/v4/objects/companies/${companyId}/associations/${type}`)));
  const openTickets = (tickets.results || []).length;
  const dealIds = (deals.results || []).map(({ toObjectId }) => toObjectId);
  const deal = dealIds[0] ? await hubspotRequest(portalId, `/crm/v3/objects/deals/${dealIds[0]}?properties=dealstage`) : null;
  const properties = { [`a${APP_ID}_company_id`]: String(companyId), [`a${APP_ID}_company_name`]: String(companyId), [`a${APP_ID}_open_tickets`]: String(openTickets), [`a${APP_ID}_overdue_deals`]: '0', [`a${APP_ID}_engagement_count`]: '0', [`a${APP_ID}_last_calculated`]: new Date().toISOString().slice(0, 10) };
  const search = await hubspotRequest(portalId, `/crm/v3/objects/${SCORE_OBJECT_TYPE}/search`, { method: 'POST', body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: `a${APP_ID}_company_id`, operator: 'EQ', value: String(companyId) }] }], properties: [`a${APP_ID}_score`] }) });
  const previous = search.results?.[0]?.properties?.[`a${APP_ID}_score`];
  const isDealEvent = isDealWebhookEvent(event);
  const associationAdded = event.renewalAction === 'association-added';
  const associationRemoved = event.renewalAction === 'association-removed';
  const stage = String(event.propertyValue || deal?.properties?.dealstage || '').toLowerCase();
  const isWon = stage.includes('closedwon');
  const isLost = stage.includes('closedlost');
  const pointChange = associationAdded ? 10
    : associationRemoved ? -15
      : isDealEvent && event.subscriptionType === 'object.propertyChange' && isWon ? 16
        : isDealEvent && event.subscriptionType === 'object.propertyChange' && isLost ? -9
          : isDealEvent && event.subscriptionType === 'object.propertyChange' ? 1 : 0;
  const eventTitle = associationAdded ? 'Deal associated with Company (+10)'
    : associationRemoved ? 'Associated deal removed from Company (-15)'
      : isDealEvent && event.subscriptionType === 'object.propertyChange' && isWon ? 'Associated deal moved to Closed Won (+16)'
        : isDealEvent && event.subscriptionType === 'object.propertyChange' && isLost ? 'Associated deal moved to Closed Lost (-9)'
          : isDealEvent && event.subscriptionType === 'object.propertyChange' ? 'Associated deal stage changed (+1)'
            : 'Renewal score recalculated';
  const result = calculateRenewalRisk({
    openTickets,
    renewalDealStage: String(event.propertyValue || deal?.properties?.dealstage || ''),
    dealCreated: associationAdded,
    dealAssociationRemoved: associationRemoved,
    dealStageChanged: isDealEvent && event.subscriptionType === 'object.propertyChange' && event.propertyName === 'dealstage',
  }, previous == null ? null : Number(previous));
  Object.assign(properties, { [`a${APP_ID}_score`]: String(result.score), [`a${APP_ID}_risk_level`]: result.riskLevel, [`a${APP_ID}_trend`]: result.trend, [`a${APP_ID}_factor_breakdown`]: JSON.stringify(result.factors) });
  let scoreRecordId = search.results?.[0]?.id;
  if (scoreRecordId) {
    await hubspotRequest(portalId, `/crm/v3/objects/${SCORE_OBJECT_TYPE}/${scoreRecordId}`, { method: 'PATCH', body: JSON.stringify({ properties }) });
  } else {
    const created = await hubspotRequest(portalId, `/crm/v3/objects/${SCORE_OBJECT_TYPE}`, { method: 'POST', body: JSON.stringify({ properties }) });
    scoreRecordId = created.id;
  }
  const labels = await hubspotRequest(portalId, `/crm/v4/associations/${SCORE_OBJECT_TYPE}/companies/labels`);
  const association = labels.results?.[0];
  if (!association) throw new Error('Renewal Radar-to-Company association type was not found.');
  await hubspotRequest(portalId, `/crm/v4/objects/${SCORE_OBJECT_TYPE}/${scoreRecordId}/associations/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify([{ associationCategory: association.category, associationTypeId: association.typeId }]),
  });
  await hubspotRequest(portalId, '/integrators/timeline/v4/events', {
    method: 'POST',
    body: JSON.stringify({
      eventTypeName: 'renewal_score_calculated',
      objectId: String(companyId),
      id: `renewal-score-${companyId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      properties: {
        score: result.score,
        riskLevel: result.riskLevel,
        openTickets,
        overdueDeals: 0,
        eventTitle,
        pointChange,
      },
    }),
  });
  console.log(`[webhook] Saved score ${result.score} for Company ${companyId}.`);
}

// Generic project webhooks identify standard objects using objectTypeId.
// Some deliveries also include the readable objectType field, so support both.
function isDealWebhookEvent(event) {
  return event.objectType === 'deal' || String(event.objectTypeId) === '0-3';
}

function isTicketEvent(event) {
  return event.objectType === 'ticket' || String(event.objectTypeId) === '0-5';
}

function getDealCompanyAssociation(event) {
  if (event.subscriptionType !== 'object.associationChange') return null;
  const fromType = String(event.fromObjectTypeId);
  const toType = String(event.toObjectTypeId);
  const removed = event.associationRemoved === true || event.associationRemoved === 'true';
  if (fromType === '0-3' && toType === '0-2') {
    return { dealId: String(event.fromObjectId), companyId: String(event.toObjectId), removed };
  }
  if (fromType === '0-2' && toType === '0-3') {
    return { dealId: String(event.toObjectId), companyId: String(event.fromObjectId), removed };
  }
  if (event.associationType === 'DEAL_TO_COMPANY') {
    return { dealId: String(event.fromObjectId), companyId: String(event.toObjectId), removed };
  }
  if (event.associationType === 'COMPANY_TO_DEAL') {
    return { dealId: String(event.toObjectId), companyId: String(event.fromObjectId), removed };
  }
  return null;
}
