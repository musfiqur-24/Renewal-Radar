const { hubspotRequest } = require('./lib/hubspot.js');
const { calculateRenewalRisk } = require('./lib/renewal-score.js');
const { claimWebhookEvent, saveDealCompanies, getDealCompanies, releaseWebhookEvent } = require('./lib/token-store.js');
const SCORE_OBJECT_TYPE = '1-12815455';
const APP_ID = '45236293';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const events = Array.isArray(req.body) ? req.body : [];
    console.log(`[webhook] Renewal Radar scorer v1 received ${events.length} event(s).`);
    await Promise.all(events.map(recalculateForEvent));
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook] Recalculation failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

async function recalculateForEvent(event) {
  const deliveryKey = event.eventId || [event.subscriptionType, event.objectId, event.occurredAt, event.propertyName, event.propertyValue].join(':');
  if (!(await claimWebhookEvent(event.portalId, deliveryKey))) {
    console.log(`[webhook] Ignored duplicate event ${deliveryKey}.`);
    return;
  }

  try {
    const objectType = event.objectType === 'ticket' ? 'tickets' : 'deals';

    // A deal creation can arrive before its Company association exists. The
    // association-change event below is the single source of truth for +10.
    if (event.objectType === 'deal' && event.subscriptionType === 'object.creation') {
      console.log(`[webhook] Deal ${event.objectId} created; waiting for its Company association.`);
      return;
    }

    let companyIds;
    if (event.objectType === 'deal' && event.subscriptionType === 'object.associationChange') {
      const companies = await hubspotRequest(event.portalId, `/crm/v4/objects/deals/${event.objectId}/associations/companies`);
      const currentCompanyIds = (companies.results || []).map(({ toObjectId }) => String(toObjectId));
      const previousCompanyIds = await getDealCompanies(event.portalId, event.objectId);
      const addedCompanyIds = currentCompanyIds.filter((companyId) => !previousCompanyIds.includes(companyId));
      const removedCompanyIds = previousCompanyIds.filter((companyId) => !currentCompanyIds.includes(companyId));
      await saveDealCompanies(event.portalId, event.objectId, currentCompanyIds);

      await Promise.all([
        ...addedCompanyIds.map((companyId) => recalculateCompany(event.portalId, companyId, { ...event, renewalAction: 'association-added' })),
        ...removedCompanyIds.map((companyId) => recalculateCompany(event.portalId, companyId, { ...event, renewalAction: 'association-removed' })),
      ]);
      if (!addedCompanyIds.length && !removedCompanyIds.length) {
        console.log(`[webhook] Deal ${event.objectId} association change did not affect a Company.`);
      }
      return;
    } else {
      const companies = await hubspotRequest(event.portalId, `/crm/v4/objects/${objectType}/${event.objectId}/associations/companies`);
      companyIds = (companies.results || []).map(({ toObjectId }) => String(toObjectId));
      if (event.objectType === 'deal' && companyIds.length) {
        await saveDealCompanies(event.portalId, event.objectId, companyIds);
      }
    }

    if (!companyIds.length) {
      console.log(`[webhook] No associated company was available for ${event.objectType} ${event.objectId}.`);
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
  const isDealEvent = event.objectType === 'deal';
  const stage = String(event.propertyValue || deal?.properties?.dealstage || '').toLowerCase();
  const isWon = stage.includes('closedwon');
  const isLost = stage.includes('closedlost');
  const pointChange = isDealEvent && event.renewalAction === 'association-added' ? 10
    : isDealEvent && event.renewalAction === 'association-removed' ? -15
      : isDealEvent && event.subscriptionType === 'object.propertyChange' && isWon ? 16
        : isDealEvent && event.subscriptionType === 'object.propertyChange' && isLost ? -9
          : isDealEvent && event.subscriptionType === 'object.propertyChange' ? 1 : 0;
  const eventTitle = isDealEvent && event.renewalAction === 'association-added' ? 'Associated deal created (+10)'
    : isDealEvent && event.renewalAction === 'association-removed' ? 'Associated deal removed from Company (-15)'
      : isDealEvent && event.subscriptionType === 'object.propertyChange' && isWon ? 'Associated deal moved to Closed Won (+16)'
        : isDealEvent && event.subscriptionType === 'object.propertyChange' && isLost ? 'Associated deal moved to Closed Lost (-9)'
          : isDealEvent && event.subscriptionType === 'object.propertyChange' ? 'Associated deal stage changed (+1)'
            : 'Renewal score recalculated';
  const result = calculateRenewalRisk({
    openTickets,
    renewalDealStage: String(event.propertyValue || deal?.properties?.dealstage || ''),
    dealCreated: isDealEvent && event.renewalAction === 'association-added',
    dealAssociationRemoved: isDealEvent && event.renewalAction === 'association-removed',
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
