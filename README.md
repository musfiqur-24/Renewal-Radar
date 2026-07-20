# Renewal Radar

Renewal Radar is a HubSpot Developer Project that surfaces account-renewal health on Company records. It is built on platform version `2026.03` and uses an app-owned object so score data does not consume a customer's custom-object allocation.

## Architecture

```text
Company record
  └─ Renewal Radar card (React UI extension)
       └─ reads the associated Renewal Radar App Object (Object Type ID: 1-12815455)

Deal / ticket change
  └─ HubSpot webhook
       └─ Vercel /api/webhook
            └─ scoring engine (to be completed)
                 ├─ creates or updates the associated App Object record
                 └─ sends a Renewal score calculated App Event to the Company timeline

Workflow enrollment
  └─ Renewal Radar workflow action
       └─ Vercel /api/workflow-action
```

## Project structure

| Path | Purpose |
| --- | --- |
| `hsproject.json` | HubSpot project name, source directory, and required `2026.03` platform version. |
| `src/app/app-hsmeta.json` | Marketplace/OAuth application configuration, scopes, permitted backend URLs, and support links. |
| `src/app/cards/` | The Company-record card. `NewCard.tsx` reads the Company’s associated Renewal Radar object using Object Type ID `1-12815455`. `card-hsmeta.json` registers its CRM location. |
| `src/app/app-objects/` | Defines the `RENEWAL_SCORE` App Object and its score, risk, trend, ticket, deal, engagement, and calculation-date properties. |
| `src/app/app-object-associations/` | Declares the App Object-to-Company association. |
| `src/app/app-events/` | Defines the Company timeline event emitted after a score calculation. |
| `src/app/webhooks/` | Subscribes to deal-stage and ticket-stage changes, delivering events to the Vercel webhook endpoint. |
| `src/app/workflow-actions/` | Registers the Renewal Radar workflow action and its inputs. |
| `api/` | Vercel functions: OAuth callback, webhook receiver, and workflow action receiver. |
| `vercel.json` | Vercel response/CORS configuration. |

## Current data flow

1. HubSpot renders `NewCard.tsx` on a Company record.
2. `useAssociations()` requests related records of App Object Type `1-12815455`.
3. The card reads the returned App Object properties, which are prefixed with `a<appId>_` by HubSpot.
4. If the Company has no associated score record yet, the card displays defaults. The scoring service is responsible for creating that record.

## Deployment

Use Node.js 20 or later, authenticate the HubSpot CLI, then run:

```powershell
hs project validate
hs project upload
```

The project auto-deploys to the configured test account. Deploy the Vercel backend separately and keep these URLs aligned with the deployed Vercel domain:

- `src/app/app-hsmeta.json` → `redirectUrls` and `permittedUrls.fetch`
- `src/app/webhooks/webhooks-hsmeta.json` → `targetUrl`
- `src/app/workflow-actions/workflow-actions-hsmeta.json` → `actionUrl`

## Remaining implementation work

The HubSpot configuration and card are deployed. The backend files still contain placeholder business logic and need a persistent OAuth-token store plus the scorer that reads associated deals/tickets/engagements, upserts the App Object record, and submits the App Event occurrence.
