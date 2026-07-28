const key = (portalId) => `renewal-radar:oauth:${portalId}`;
const webhookKey = (portalId, eventKey) => `renewal-radar:webhook:${portalId}:${eventKey}`;
const associationKey = (portalId, companyId, dealId, removed, occurredAt) =>
  `renewal-radar:association:${portalId}:${companyId}:${dealId}:${removed}:${occurredAt}`;
const companyLockKey = (portalId, companyId) => `renewal-radar:score-lock:${portalId}:${companyId}`;

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

async function acquireCompanyScoreLock(portalId, companyId) {
  const response = await kv(['set', companyLockKey(portalId, companyId), '1', 'NX', 'EX', '60']);
  return response.result === 'OK';
}

async function releaseCompanyScoreLock(portalId, companyId) {
  await kv(['del', companyLockKey(portalId, companyId)]);
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
  acquireCompanyScoreLock,
  releaseCompanyScoreLock,
  releaseWebhookEvent,
};
