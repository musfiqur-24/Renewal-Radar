/**
 * Vercel Serverless Function: POST /api/workflow-action
 *
 * This endpoint is the `actionUrl` for the Renewal Radar custom
 * HubSpot Workflow Action. HubSpot calls this URL when the action
 * is triggered in a contact workflow.
 *
 * HubSpot sends a POST body with:
 *   - inputFields: { message, priority } (defined in workflow-actions-hsmeta.json)
 *   - object.objectId: the Contact's HubSpot ID
 *   - portalId: the HubSpot portal ID
 *   - callbackId: used to send the result back to HubSpot asynchronously
 *
 * Docs: https://developers.hubspot.com/docs/apps/developer-platform/add-features/workflow-actions
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    inputFields,
    object,
    portalId,
    callbackId,
    origin,
  } = req.body || {};

  if (!inputFields || !object) {
    console.warn('[workflow-action] Missing required fields in request body:', req.body);
    return res.status(400).json({ error: 'Invalid payload — missing inputFields or object.' });
  }

  const { message, priority } = inputFields;
  const contactId = object?.objectId;

  console.log(`[workflow-action] Triggered for contact ${contactId} on portal ${portalId}`);
  console.log(`[workflow-action] Priority: ${priority} | Message: "${message}"`);
  console.log(`[workflow-action] CallbackId: ${callbackId}`);
  console.log(`[workflow-action] Origin: ${JSON.stringify(origin)}`);

  try {
    // Execute the workflow action business logic
    await processWorkflowAction({ contactId, message, priority, portalId });

    // Return success to HubSpot — this completes the workflow action
    // HubSpot also supports async callbacks via the `callbackId`, but
    // synchronous responses are simpler for most use cases.
    return res.status(200).json({
      outputFields: {
        result: `Renewal Radar action completed — ${priority} priority notification sent.`,
      },
    });
  } catch (err) {
    console.error('[workflow-action] Error processing action:', err.message);
    // Return error — HubSpot will mark the action as failed in the workflow
    return res.status(500).json({
      errorType: 'ACTION_FAILED',
      message: err.message,
    });
  }
};

/**
 * Process the workflow action.
 *
 * @param {object} params
 * @param {string} params.contactId - HubSpot Contact ID
 * @param {string} params.message - Notification message from the workflow
 * @param {string} params.priority - Priority level: high | normal | low
 * @param {number} params.portalId - HubSpot portal ID
 */
async function processWorkflowAction({ contactId, message, priority, portalId }) {
  console.log(`[workflow-action] Processing: Contact ${contactId}, Priority: ${priority}`);

  // TODO: Implement the actual action logic, for example:
  // - Send a Slack notification with the message and priority
  // - Create a HubSpot Task on the contact's record
  // - Send an email via a notification service
  // - Trigger a renewal risk recalculation for the contact's company

  // Example: log the action (replace with real implementation)
  console.log(`[workflow-action] Would send ${priority.toUpperCase()} priority notification:`);
  console.log(`[workflow-action] "${message}"`);
  console.log(`[workflow-action] To team responsible for contact ${contactId} on portal ${portalId}`);
}
