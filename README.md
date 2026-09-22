# AeroSlot: external empty-leg marketplace

This repository contains a deployed Next.js/Sites marketplace and a separate reference Prisma/Node service. The hosted build uses Cloudflare D1, **not PostgreSQL**. It never invents live inventory: until you connect an approved source or an operator publishes a leg, the live marketplace is empty. The built-in flights are explicitly labelled sample data and cannot be requested.

## What works today

- Responsive route, date, seats and budget search; 30-second inventory polling; source health and stale-feed display.
- Operator-only manual publishing with server-side authorization via the hosted sign-in identity and `OPERATOR_USER_IDS`.
- FL3XX adapter for an operator's selected, priced empty legs (`GET /api/external/quote/legs/empty`, `X-Auth-Token`). The sync imports valid rows, records sync health and hides FL3XX offers more than 30 minutes old. Incomplete/malformed responses do not expire unseen offers.
- Account-bound route alerts with match records. Availability requests are account-bound, idempotent per user and leg; FL3XX source, price, seats and time are rechecked immediately before saving a request.
- D1 migrations in `drizzle/`. `db/seed.sql` is a **local sample only**; do not apply it to production.

## Connect a real FL3XX operator

1. Obtain FL3XX API access for an operator account and permission to display its selected, priced empty legs. Set the following **server-side** environment variables in your site hosting settings; never use `NEXT_PUBLIC_` for secrets:

   - `FL3XX_API_BASE_URL` — the HTTPS API base URL supplied by FL3XX, e.g. an origin ending in `/`; the adapter appends `api/external/quote/legs/empty`.
   - `FL3XX_API_TOKEN` — that operator's `X-Auth-Token`.
   - `FL3XX_OPERATOR_ID` — your stable internal operator identifier. This is namespacing, not an FL3XX request parameter.
   - `INVENTORY_SYNC_TOKEN` — an independently generated high-entropy bearer token for your scheduler.
   - `OPERATOR_USER_IDS` — comma-separated **hosted identity user IDs** of trusted people who can manually publish; leave empty if you do not need manual posting.

2. Configure your scheduler to call `POST https://YOUR_SITE/api/sync/fl3xx` with header `Authorization: Bearer <INVENTORY_SYNC_TOKEN>` every 15 minutes. It must retry failures with backoff and alert your team on repeated failure. This repository does **not** provision the external scheduler.
3. Verify `GET /api/sources` reports a recent successful sync and imported count; check the live tab with sample mode off. API keys alone do not trigger a sync.
4. Test with your operator's approved data and confirm the contractual display, attribution, lead-routing and retention rules before public launch.

FL3XX API reference: https://developer.fl3xx.com/docs/marketplace-empty-legs (verify your account's exact feed contract and endpoint).

## Provider expansion

`Avinode` and `Leon` appear as disconnected source cards, **not functional connectors**. Their marketplace access requires separate agreements. In particular, Avinode's end-client search results cannot be stored in your own inventory database under its general search terms, so it must not be ingested into the FL3XX snapshot table. Implement Avinode as an approved on-demand search and lead-routing flow, or use its separately authorized subscription/watch path according to the signed agreement. Leon aggregation/empty-leg marketplace access likewise requires the appropriate commercial arrangement. Never populate these sources by scraping a website.

## Production architecture and launch gates

| Concern | Current hosted site | Production addition |
|---|---|---|
| Inventory | D1 snapshot for FL3XX and direct-operator posts | Per-operator source accounts, scheduled jobs, bounded concurrency, retries, sync observability and explicit rights metadata |
| Search | Hosted D1 + 30-second browser polling | Postgres/PostGIS geo search, materialized route index, dedicated authenticated WebSocket/SSE gateway |
| Matching | Exact airport, seats and maximum-price match records | Departure windows, nearby-airport geospatial index, deduplication, queue and notification preferences |
| Alerts | Persisted and matched, no delivery | Push subscription endpoint, opt-in, worker queue, retry and unsubscribe |
| Requests | Saves an unconfirmed request after source recheck | Contract-authorized operator lead/RFQ submission, acknowledgement, hold lifecycle, inventory recheck at confirmation |
| Payments | Disabled | Stripe Checkout only after verified operator confirmation, signed webhook, idempotent booking transitions, cancellation/refund handling |
| Identity | Hosted sign-in identity, server-side role gate | Operator onboarding, auditable role grants, account ownership and least-privilege service credentials |
| Map | Route detail only; no live geographic map | Geocode licensed airport records, display provenance-aware routes and filters |

The `prisma/schema.prisma` is a reference model for a **separately deployed** Node/Postgres service. `server/socket-server.ts` is a separate, minimally authenticated Socket.IO refresh-hint gateway; the hosted site does not emit to or subscribe to it. Do not deploy either as a complete booking backend without integrating identity, migrations, authorization, source policy, replay/rate-limit controls and an event queue. The hosted runtime cannot itself host a persistent Node TCP WebSocket server or use the PostgreSQL connection assumed by Prisma.

## Local development

Install dependencies with the project package manager, run `pnpm dev`, and use the site's normal migration workflow for D1. `pnpm exec tsc --noEmit` type-checks the hosted site. Sample data lives in the UI; production D1 remains empty until an authorized operator posts or FL3XX sync succeeds. Consult `.env.example` for secret names, but set production secrets in the hosting environment, never in source control.
