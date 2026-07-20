const { getTokens, saveTokens } = require('./token-store.js');

async function refresh(tokens) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, refresh_token: tokens.refresh_token });
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error('Unable to refresh HubSpot OAuth token.');
  return response.json();
}

async function hubspotRequest(portalId, path, options = {}) {
  let tokens = await getTokens(portalId);
  if (!tokens) throw new Error(`No OAuth tokens stored for portal ${portalId}. Reinstall the app after configuring Vercel KV.`);
  if (tokens.expiresAt <= Date.now() + 60_000) { tokens = await refresh(tokens); await saveTokens(portalId, tokens); }
  const response = await fetch(`https://api.hubapi.com${path}`, { ...options, headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error(`HubSpot API ${path} failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

module.exports = { hubspotRequest };
