const key = (portalId) => `renewal-radar:oauth:${portalId}`;

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

module.exports = { getTokens, saveTokens };
