/**
 * local-dev.js — Local OAuth Callback Server
 *
 * Run this BEFORE `hs project dev` to handle the OAuth installation flow
 * during local development. In production, this role is handled by the
 * Vercel serverless function at backend/api/oauth/callback.js
 *
 * Usage:
 *   npm run dev:oauth        (from the project root)
 *   node backend/local-dev.js
 *
 * Then in a second terminal:
 *   npm run dev:hubspot      (runs `hs project dev`)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env from the project root
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^([^#][^=]*)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    });
    console.log('[local-dev] Loaded .env from project root');
  } catch {
    console.warn('[local-dev] No .env file found, using system environment variables.');
  }
}
loadEnv();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/oauth/callback';
const PORT = 3000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('[local-dev] ERROR: CLIENT_ID and CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`[local-dev] ${req.method} ${req.url}`);

  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error(`[local-dev] OAuth error: ${error}`);
      res.writeHead(400, { 'Content-Type': 'text/html' });
      return res.end(`<h2>Authorization Failed</h2><p>${error}</p>`);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing authorization code');
    }

    console.log(`[local-dev] Received code. Exchanging for tokens...`);

    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
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

    const tokenReq = https.request(options, (tokenRes) => {
      let body = '';
      tokenRes.on('data', (chunk) => (body += chunk));
      tokenRes.on('end', () => {
        if (tokenRes.statusCode === 200) {
          const tokens = JSON.parse(body);
          console.log('\n[local-dev] ✅ Token exchange successful!');
          console.log(`  Access Token  : ${tokens.access_token.substring(0, 16)}...`);
          console.log(`  Refresh Token : ${tokens.refresh_token.substring(0, 16)}...`);
          console.log(`  Hub ID        : ${tokens.hub_id}`);
          console.log('\n[local-dev] You can now return to your hs project dev terminal.\n');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body style="font-family:sans-serif;padding:2rem;text-align:center;">
              <h2>✅ App Successfully Installed!</h2>
              <p>The code was exchanged for an access token.</p>
              <p>Return to your terminal — <code>hs project dev</code> should now proceed.</p>
              <p style="color:#999;font-size:0.875rem;">Hub ID: ${tokens.hub_id}</p>
            </body></html>
          `);
        } else {
          console.error(`[local-dev] ❌ Token exchange failed (${tokenRes.statusCode}):`, body);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Token exchange failed: ${body}`);
        }
      });
    });

    tokenReq.on('error', (e) => {
      console.error('[local-dev] Request error:', e.message);
      res.writeHead(500);
      res.end(`Error: ${e.message}`);
    });

    tokenReq.write(postData);
    tokenReq.end();
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found — try /oauth/callback');
  }
});

server.listen(PORT, () => {
  console.log(`\n[local-dev] OAuth callback server running at http://localhost:${PORT}/oauth/callback`);
  console.log('[local-dev] Now run `npm run dev:hubspot` in a separate terminal.\n');
});
