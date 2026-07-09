# Renewal Radar 🎯

A HubSpot Marketplace App that surfaces **renewal risk scores** directly on Company records in HubSpot CRM. It analyzes deal stage changes, open support tickets, and engagement history to give your sales team a real-time health signal for every account.

---

## Architecture

```
renewal-radar/
├── backend/                         ← Vercel Serverless Backend
│   ├── api/
│   │   ├── oauth/callback.js        ← OAuth token exchange endpoint
│   │   ├── webhook.js               ← HubSpot event receiver
│   │   └── workflow-action.js       ← Custom workflow action handler
│   ├── local-dev.js                 ← Local OAuth server (for `hs project dev`)
│   ├── package.json
│   └── vercel.json                  ← Vercel deployment config
│
└── src/                             ← HubSpot Project (UI Extensions)
    └── app/
        ├── app-hsmeta.json          ← App config: OAuth, scopes, redirect URLs
        ├── cards/                   ← Renewal Score card (shown on Company records)
        │   └── NewCard.tsx
        ├── pages/                   ← Full-page App Extension
        │   ├── Pages.tsx
        │   ├── HomePage.tsx
        │   └── DocsPage.tsx
        ├── settings/                ← App Settings page
        │   └── SettingsPage.tsx
        ├── webhooks/                ← HubSpot webhook subscriptions
        │   └── webhooks-hsmeta.json
        └── workflow-actions/        ← Custom HubSpot Workflow Action
            └── workflow-actions-hsmeta.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [HubSpot CLI](https://developers.hubspot.com/docs/developer-tooling/hubspot-cli/overview) (`npm install -g @hubspot/cli`)
- A HubSpot Developer Account with a test portal
- A [Vercel](https://vercel.com) account (for backend deployment)

---

## Local Development

### 1. Clone and set up environment variables

```bash
git clone https://github.com/YOUR_USERNAME/renewal-radar.git
cd renewal-radar
cp .env.example .env
# Edit .env with your HubSpot App CLIENT_ID and CLIENT_SECRET
```

### 2. Authenticate the HubSpot CLI

```bash
hs init
# Follow the prompts to connect your HubSpot test account
```

### 3. Start the local OAuth callback server

Open **Terminal 1** and run:
```bash
npm run dev:oauth
# Starts the local server at http://localhost:3000/oauth/callback
```

### 4. Start the HubSpot local dev server

Open **Terminal 2** and run:
```bash
npm run dev:hubspot
# Runs `hs project dev`
```

When the CLI prints an **Install URL**, open it in your browser. You'll be redirected through HubSpot's OAuth flow, then back to `localhost:3000/oauth/callback`, which will complete the token exchange. After that, the CLI will proceed and you can view your UI extensions live in HubSpot.

### 5. View the card in HubSpot

Once `hs project dev` is running:
1. Go to your HubSpot test portal.
2. Navigate to **CRM → Companies** and open any company record.
3. Click the **Renewal Radar** tab to see the card — changes to `NewCard.tsx` hot-reload automatically.

---

## Deployment

### Deploy the Backend to Vercel

```bash
cd backend
npx vercel login
npx vercel --prod
```

Set environment variables in the Vercel dashboard (or via CLI):
```bash
vercel env add CLIENT_ID
vercel env add CLIENT_SECRET
vercel env add REDIRECT_URI   # https://your-project.vercel.app/api/oauth/callback
```

### Update HubSpot App Config

After you get your Vercel URL, update these two files with your real URL:

- `src/app/app-hsmeta.json` — update `redirectUrls` and `permittedUrls.fetch`
- `src/app/webhooks/webhooks-hsmeta.json` — update `targetUrl`
- `src/app/workflow-actions/workflow-actions-hsmeta.json` — update `actionUrl`

Then upload:
```bash
npm run upload
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev:oauth` | Start local OAuth callback server on port 3000 |
| `npm run dev:hubspot` | Start HubSpot local dev server (`hs project dev`) |
| `npm run upload` | Build and upload the project to HubSpot |
| `npm run validate` | Validate HubSpot project config without uploading |

---

## HubSpot Components

| Component | Type | Description |
|---|---|---|
| `NewCard` | `card` | Renewal score displayed on Company record tabs |
| `Pages` | `pages` | Full-page app with Home and Docs routes |
| `SettingsPage` | `settings` | App configuration settings |
| `webhooks` | `webhooks` | Listens to deal stage changes in real-time |
| `workflow-action` | `workflow-action` | "Renewal Radar — Send Alert" custom workflow action |

---

## API Endpoints (Vercel Backend)

| Endpoint | Method | Description |
|---|---|---|
| `/api/oauth/callback` | `GET` | OAuth code → token exchange |
| `/api/webhook` | `POST` | Receive HubSpot CRM event notifications |
| `/api/workflow-action` | `POST` | Execute custom workflow action logic |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list of required variables.

| Variable | Description |
|---|---|
| `CLIENT_ID` | HubSpot App Client ID |
| `CLIENT_SECRET` | HubSpot App Client Secret |
| `REDIRECT_URI` | OAuth redirect URL (localhost for dev, Vercel for prod) |
| `HUBSPOT_PORTAL_ID` | Your HubSpot portal/account ID |
| `WEBHOOK_SECRET` | Secret to verify webhook signatures (optional) |
