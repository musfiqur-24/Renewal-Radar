const { hubspotRequest } = require('./lib/hubspot.js');
const { calculateRenewalRisk } = require('./lib/renewal-score.js');
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
  const objectType = event.objectType === 'ticket' ? 'tickets' : 'deals';
  const companies = await hubspotRequest(event.portalId, `/crm/v4/objects/${objectType}/${event.objectId}/associations/companies`);
  await Promise.all((companies.results || []).map(({ toObjectId }) => recalculateCompany(event.portalId, toObjectId, event)));
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
  const result = calculateRenewalRisk({
    openTickets,
    renewalDealStage: String(event.propertyValue || deal?.properties?.dealstage || ''),
    dealCreated: isDealEvent && event.subscriptionType === 'object.creation',
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
      },
    }),
  });
  console.log(`[webhook] Saved score ${result.score} for Company ${companyId}.`);
}
