const key = (portalId) => `renewal-radar:oauth:${portalId}`;
const webhookKey = (portalId, eventKey) => `renewal-radar:webhook:${portalId}:${eventKey}`;
const companyDealsKey = (portalId, companyId) => `renewal-radar:company-deals:${portalId}:${companyId}`;

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

async function saveCompanyDeals(portalId, companyId, dealIds) {
  await kv(['set', companyDealsKey(portalId, companyId), JSON.stringify(dealIds), 'EX', '2592000']);
}

async function getCompanyDeals(portalId, companyId) {
  const response = await kv(['get', companyDealsKey(portalId, companyId)]);
  return response.result ? JSON.parse(response.result) : [];
}

async function releaseWebhookEvent(portalId, eventKey) {
  await kv(['del', webhookKey(portalId, eventKey)]);
}

module.exports = {
  getTokens,
  saveTokens,
  claimWebhookEvent,
  saveCompanyDeals,
  getCompanyDeals,
  releaseWebhookEvent,
};
