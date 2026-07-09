/**
 * Vercel Serverless Function: POST /api/webhook
 *
 * Receives event notifications from HubSpot. Currently subscribed to:
 *  - deal.propertyChange (dealstage) — fires when a deal moves pipeline stage
 *
 * HubSpot sends an array of event objects in the request body.
 * Each event has: subscriptionType, objectId, propertyName, propertyValue, etc.
 *
 * Docs: https://developers.hubspot.com/docs/api/webhooks
 */

module.exports = async (req, res) => {
  // Vercel handles CORS but HubSpot sends POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Webhooks must be POST requests.' });
  }

  const events = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    console.warn('[webhook] Received empty or malformed payload');
    return res.status(400).json({ error: 'Invalid payload — expected an array of events.' });
  }

  console.log(`[webhook] Received ${events.length} event(s)`);

  // Process each event
  for (const event of events) {
    const {
      subscriptionType,
      objectId,
      objectType,
      propertyName,
      propertyValue,
      portalId,
      occurredAt,
    } = event;

    console.log(`[webhook] Event: ${subscriptionType} | Object: ${objectType}(${objectId}) | ${propertyName}=${propertyValue} | Portal: ${portalId}`);

    // Route to the appropriate handler
    if (subscriptionType === 'object.propertyChange' && propertyName === 'dealstage') {
      await handleDealStageChange({ objectId, propertyValue, portalId, occurredAt });
    } else {
      console.log(`[webhook] Unhandled subscription type: ${subscriptionType}`);
    }
  }

  // Always respond with 200 quickly so HubSpot doesn't retry
  return res.status(200).json({ received: true, count: events.length });
};

/**
 * Handle deal stage change events.
 * When a deal moves stages, we can:
 *   1. Look up the associated company
 *   2. Re-calculate the renewal risk score
 *   3. Update the company's CRM properties
 *
 * @param {object} params
 * @param {string} params.objectId - The Deal's HubSpot ID
 * @param {string} params.propertyValue - The new deal stage ID
 * @param {number} params.portalId - The HubSpot portal ID
 * @param {number} params.occurredAt - Unix timestamp of when the event occurred
 */
async function handleDealStageChange({ objectId, propertyValue, portalId, occurredAt }) {
  console.log(`[webhook] Deal ${objectId} moved to stage: ${propertyValue}`);
  console.log(`[webhook] Portal: ${portalId}, Occurred at: ${new Date(occurredAt).toISOString()}`);

  // TODO: Implement renewal score recalculation logic:
  // 1. Fetch deal details from HubSpot CRM API
  // 2. Find the associated Company record
  // 3. Calculate a new renewal risk score based on:
  //    - Deal stage (won/lost/open)
  //    - Open support tickets
  //    - Last engagement date
  //    - Contract value
  // 4. Update the Company's custom properties via HubSpot API
  //    e.g., PATCH https://api.hubapi.com/crm/v3/objects/companies/{companyId}

  console.log(`[webhook] TODO: recalculate renewal score for deal ${objectId}`);
}
