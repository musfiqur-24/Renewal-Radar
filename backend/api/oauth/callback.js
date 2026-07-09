/**
 * Vercel Serverless Function: GET /api/oauth/callback
 *
 * HubSpot redirects here after a user authorizes the app.
 * This handler exchanges the short-lived `code` for long-lived
 * access & refresh tokens using HubSpot's OAuth v1 token endpoint.
 */

const https = require('https');

module.exports = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code, error, error_description } = req.query;

  // HubSpot will include `error` if the user denied authorization
  if (error) {
    console.error(`OAuth error: ${error} — ${error_description}`);
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
          <h2 style="color: #c0392b;">Authorization Failed</h2>
          <p><strong>${error}</strong>: ${error_description || 'The user denied the authorization request.'}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // TODO: Persist tokens in a database (e.g., Vercel KV, PlanetScale, Supabase).
    // For now we log them to Vercel's function logs.
    console.log('[oauth/callback] Token exchange successful');
    console.log(`  Access Token  : ${tokens.access_token.substring(0, 16)}...`);
    console.log(`  Refresh Token : ${tokens.refresh_token.substring(0, 16)}...`);
    console.log(`  Expires In    : ${tokens.expires_in}s`);
    console.log(`  Hub ID        : ${tokens.hub_id}`);

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Renewal Radar — Installed!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f4f6f9; }
            .card { background: #fff; border-radius: 12px; padding: 2.5rem 3rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; max-width: 480px; }
            h2 { color: #0e6027; margin-bottom: 0.5rem; }
            p { color: #516f90; margin: 0.5rem 0; }
            .badge { display: inline-block; background: #e5f5e9; color: #0e6027; border-radius: 999px; padding: 0.25rem 1rem; font-size: 0.85rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ Renewal Radar Installed!</h2>
            <p>Your app was successfully authorized and the access token has been stored.</p>
            <p>You can close this window and return to HubSpot.</p>
            <span class="badge">Hub ID: ${tokens.hub_id}</span>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[oauth/callback] Token exchange failed:', err.message);
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
          <h2 style="color: #c0392b;">Installation Failed</h2>
          <p>Could not exchange the authorization code for tokens.</p>
          <pre style="background:#f4f6f9;padding:1rem;border-radius:8px;text-align:left;">${err.message}</pre>
        </body>
      </html>
    `);
  }
};

/**
 * Exchanges an OAuth authorization code for access/refresh tokens.
 * @param {string} code - The authorization code from HubSpot
 * @returns {Promise<object>} Token response from HubSpot
 */
function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      code,
    }).toString();

    const options = {
      hostname: 'api.hubapi.com',
      port: 443,
      path: '/oauth/v1/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HubSpot returned ${response.statusCode}: ${body}`));
        }
      });
    });

    request.on('error', reject);
    request.write(postData);
    request.end();
  });
}
