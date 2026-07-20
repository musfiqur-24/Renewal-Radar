const key = (portalId) => `renewal-radar:oauth:${portalId}`;
const webhookKey = (portalId, eventKey) => `renewal-radar:webhook:${portalId}:${eventKey}`;
const associationKey = (portalId, companyId, dealId, removed, occurredAt) =>
  `renewal-radar:association:${portalId}:${companyId}:${dealId}:${removed}:${occurredAt}`;

async function kv(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be configured.');
  const response = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Token store request failed (${response.status}).`);
  return response.json();
}

async function saveTokens(portalId, tokens) {
  await kv(['set', key(portalId), JSON.stringify({ ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 })]);
}

async function getTokens(portalId) {
  const response = await kv(['get', key(portalId)]);
  return response.result ? JSON.parse(response.result) : null;
}

// HubSpot can retry the same delivery.  Scoring is incremental, so accept a
// delivery only once; Upstash SET NX returns null when the key already exists.
async function claimWebhookEvent(portalId, eventKey) {
  const response = await kv(['set', webhookKey(portalId, eventKey), '1', 'NX', 'EX', '86400']);
  return response.result === 'OK';
}

async function claimAssociationTransition(portalId, companyId, dealId, removed, occurredAt) {
  const response = await kv(['set', associationKey(portalId, companyId, dealId, removed, occurredAt), '1', 'NX', 'EX', '300']);
  return response.result === 'OK';
}

async function releaseAssociationTransition(portalId, companyId, dealId, removed, occurredAt) {
  await kv(['del', associationKey(portalId, companyId, dealId, removed, occurredAt)]);
}

async function releaseWebhookEvent(portalId, eventKey) {
  await kv(['del', webhookKey(portalId, eventKey)]);
}

module.exports = {
  getTokens,
  saveTokens,
  claimWebhookEvent,
  claimAssociationTransition,
  releaseAssociationTransition,
  releaseWebhookEvent,
};
