# Threat Model

## Project Overview

MY PENS is a Next.js 16 App Router application for personal health and recovery tracking. It stores highly sensitive biometric, behavioral, and recovery data in a local SQLite database via Prisma, exposes browser-facing API routes under `app/api/**`, and integrates with Strava, Garmin, Apple HealthKit, and Android Health Connect. In production, TLS is handled by the platform and `NODE_ENV` can be assumed to be `production`.

The application is implemented as a single-user system: many records and integration connections are keyed to the placeholder `userId: "default"` rather than to an authenticated principal. That architectural choice is only safe if every production route that reads or mutates data is protected by an equivalent server-side access-control boundary.

## Assets

- **Health and biometric data** — weight, body fat, body measurements, sleep, HRV, food intake, workouts, Garmin archive data, and dashboard-derived insights. Exposure would reveal intimate medical and lifestyle information.
- **Recovery and behavioral data** — recovery entries, craving events, substance-use flags, notes, baseline assumptions, and milestones. This is especially sensitive because it covers addiction/recovery history and free-text notes.
- **Integration secrets and connection state** — Strava/Garmin OAuth access and refresh tokens, HealthKit/Health Connect pairing tokens, webhook verify tokens, cron secrets, and last-error state. Compromise enables data exfiltration, false data injection, or ongoing account takeover of connected services.
- **Operational data and uploaded media** — measurement progress photos, backup artifacts, notifications, skipped-workout tombstones, and raw imported activity payloads.

## Trust Boundaries

- **Browser to Next.js route handlers** — every request to `app/api/**` crosses from an untrusted client into server code. All identity, authorization, and input validation must be enforced server-side.
- **Companion mobile app to ingest endpoints** — HealthKit and Health Connect companions authenticate with bearer pairing tokens. Those tokens are equivalent to write access for the related ingest pipeline and must only be issued to an authorized user.
- **Server to SQLite via Prisma** — compromise of route handlers effectively becomes compromise of the entire datastore because the app uses a single database with no per-user isolation.
- **Server to third-party integrations** — Strava and Garmin OAuth/token flows, webhook callbacks, and follow-up API fetches cross into external services and must defend against spoofed callbacks and unintended outbound requests.
- **Cron/system callers to maintenance routes** — cron endpoints rely on `CRON_SECRET` and should never be reachable without that secret.
- **Public vs owner-only surface** — the application may be conceptually single-user, but in production every route that reads or mutates personal data must still enforce that only the owner can use it.

## Scan Anchors

- **Production entry points**: `app/**`, especially `app/api/**`, `app/page.tsx`, `proxy.ts`, `lib/integrations/**`, `app/api/measurements/photo/route.ts`, `app/api/backup/route.ts`.
- **Highest-risk areas**: all route handlers under `app/api/**`; integration token issuance/ingest/webhook code under `app/api/integrations/**` and `lib/integrations/**`; file-system touching routes (`measurements/photo`, `backup`).
- **Public vs authenticated/admin surfaces**: no dedicated admin surface is apparent; most risk comes from owner-only health data endpoints that may currently behave as public routes.
- **Usually dev-only / skip unless proven reachable in production**: `/mockups`, design assets, local Garmin `.fit` import scripts, and local-only tooling/scripts.

## Threat Categories

### Spoofing

This project has no obvious general-purpose production authentication layer for browser access, yet it stores data for a single logical owner under `userId: "default"`. The application must ensure that every owner-only route verifies a real authenticated identity before serving or mutating data. Companion pairing tokens, cron secrets, OAuth state cookies, and webhook verification material must be unforgeable and never issued or rotated through unauthenticated endpoints.

### Tampering

Clients can submit health logs, notes, imported workouts, pairing requests, skipped-workout changes, and integration control actions. The server must treat all client input as untrusted, validate structure and ranges, and ensure only the owner can create, update, delete, import, disconnect, or reconfigure records. Webhook payloads and any URLs fetched as a consequence of webhook processing must be strongly verified to prevent attacker-triggered server-side actions.

### Information Disclosure

The database contains highly sensitive medical, behavioral, and lifestyle information plus integration secrets and error state. All API responses that expose this data must require authenticated owner access, and routes must not leak pairing tokens, imported raw payloads, backup metadata, or internal error details to anonymous callers. Uploaded measurement photos and exported data must be treated as private owner data even though they are application artifacts.

### Denial of Service

The app includes file uploads, backup creation, CSV import, webhook processing, and integration sync flows that can consume CPU, disk, or database capacity. Production routes must enforce strong access control before expensive operations, apply request-size/rate limits where appropriate, and avoid allowing unauthenticated callers to trigger repeated expensive work or unbounded background processing.

### Elevation of Privilege

Because the application is architected around a single placeholder user, any missing access-control check effectively grants an anonymous internet caller the same privileges as the owner. The required guarantee is stronger than ordinary per-record authorization: every owner-only route must be behind a server-side authentication boundary, and integration management endpoints must not let unauthenticated callers mint new bearer tokens, rotate connections, or take over linked third-party accounts.