# My Pens App

A personal health tracking Next.js application — an interpretation layer between raw trackers and everyday users.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: SQLite via Prisma ORM (`prisma/dev.db`)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts

## Home Page (`/`)

Editorial "Today's Intent" mode-selection screen (Stitch design system port — Newsreader serif headlines, asymmetric 1+2 mode-card grid, Auditor's Note pull-quote). Immersive mode cards (Locked In / Balanced / Off), streak badge, context tags, top app bar (Auditor brand), bottom mobile nav. Date/time computed client-side after mount to avoid hydration mismatch. Mode streak count from `/api/mode` GET + POST.

## Welcome / Onboarding (`/welcome`, `/onboarding`)

Continental brand entry surface (server components, no data fetch). `/welcome` is the split-layout intro with MY PENS branding, P.E.N.S. pillars bento, and CTA → `/onboarding`. `/onboarding` is the "Initial Audit" hero + 4-card P.E.N.S. field bento with CTA → `/`. Both are static and not yet linked from the daily flow.

## Damage Audit (`/verdict/dossier`)

Server component reading today's `WeightEntry`, `SleepEntry`, `DayEntry` via Prisma directly. Computes honest proxies: ethanol offset kcal (`alcoholUnits × 70`), dehydration liters (`× 0.25`), inflammation % (`× 4`, capped 40), metabolic deficit (sleep deficit + alcohol impact composite). Bento layout (Ethanol Offset / Inflammation Tax / Dehydration Penalty), editorial breakdown sections (Sleep Debt / Endocrine Shift) with real sleep hours + HRV. No-alcohol guard surfaces when `alcoholUnits=0` and `hoursSinceAlcohol≥24`. Linked from top of `/verdict`.

## Typography

Newsreader serif (`--font-newsreader` → `--font-headline`) loaded in root layout for editorial headlines on the new Continental screens; Geist remains the default body font.

## Modules

- **Weight** (`/weight`): Scale readings with full v3 water retention model (creatine, alcohol, glycogen, sodium, hard training). Per-entry confidence scoring, EWMA baseline trend, outlier detection, dynamic uncertainty band.
- **Food** (`/food`): Meal logging with macros (protein, carbs, fat, fiber). Preset-based quick entry.
- **Sleep** (`/sleep`): Bedtime/wake tracking with HRV and quality scores. 30-day trend.
- **Training** (`/training`): Exercise sets/reps/weight logging, auto-calculated volume. Exercise names are clickable to open an all-time history drawer with personal best and progression charts.
- **Measurements** (`/measurements`): Body tape measurements with delta tracking.
- **Events** (`/events`): Trip/event tagging (travel, illness, holiday, diet-break, competition, other). Active events shown as banners on weight page and dashboard.
- **Dashboard** (`/dashboard`): Weekly overview with structured insight cards (positive/info/warning), real confidence data, logging streaks widget, Goals panel (set weight/waist/session targets with progress bars and ETAs), CSV export, CSV import, and database backup.
- **Data Health** (`/data-health`): 30-day logging calendar heatmap per module, current streaks, longest streaks, and coverage percentages.
- **Garmin Archive** (`/garmin`): Bulk historical import of Garmin `.fit` files (years 2019–2026) into a separate `GarminActivity` table — distinct from the live OAuth `/integrations` flow. Drop files into `garmin_activities/<YEAR>/`, run `python3 scripts/import-garmin.py` (uses `fitparse`, idempotent on `fitFileId`). Page shows year/sport filters, summary tiles, weekly distance chart, and full activity list with pace/HR/calories.
- **Integrations** (`/integrations`): Connect external workout sources. Each provider has its own card with status / connect / disconnect / sync / review pipeline. Imported activities become `TrainingEntry` rows tagged with `source` + `externalId` (unique) + `externalUrl`, deduped on re-sync, and remain editable. Disconnecting removes tokens but keeps imported entries.
  - **Strava** — OAuth 2.0 (`read,activity:read`), pulls last 30 days of activities. Auto-syncs in the background via Strava push subscriptions (subscribed at OAuth callback time, callback at `/api/integrations/strava/webhook`); a daily fallback cron at `/api/integrations/strava/cron` (auth: `Authorization: Bearer $CRON_SECRET` or `?secret=`) re-pulls the last 7 days. Webhook + cron auto-import drafts (no review queue) and stamp `lastSyncAt` / `lastError` on `StravaConnection`, both surfaced on the Integrations page.
  - **Garmin Connect** — OAuth 2.0 + PKCE (`ACTIVITY_READ`), walks day-by-day windows of `apis.garmin.com/wellness-api/rest/activities`.
  - **Apple Health (HealthKit)** — pairing-token model (HealthKit is iOS-only). Web mints a long-lived bearer token; iOS companion app POSTs `HKWorkout` summaries to `/api/integrations/healthkit/ingest`. Pushed workouts queue in `PushedWorkout` for review.
  - **Health Connect (Android)** — same pairing-token model; Android companion POSTs `ExerciseSessionRecord`s to `/api/integrations/healthconnect/ingest`.
  - **Stale-pairing nudges** — `/api/cron/check-stale-pairings` (auth: `Authorization: Bearer $CRON_SECRET`) scans HealthKit / Health Connect connections daily; when a row's `lastSyncAt` (or `createdAt` for never-synced rows) is older than `MOBILE_STALE_THRESHOLD_HOURS` (default 48), it drops a single in-app `Notification` (kind `stale_pairing`, href `/integrations`). Idempotency is enforced by stamping `lastStaleNotifiedAt` via a conditional `updateMany`; once a recovery sync advances `lastSyncAt` past that stamp, the next stale gap renotifies. Pass `?dryRun=1` to preview eligible rows without writing.

## Key Files

- `lib/retentionModels.ts` — Core water retention model, confidence scoring, EWMA trend, dynamic band, outlier detection
- `lib/db.ts` — Prisma singleton
- `app/api/weight/route.ts` — Weight POST (calculates breakdown) + GET (enriched with v3 trend layer)
- `app/api/dashboard/route.ts` — Dashboard aggregation with structured insights and real confidence data
- `app/api/goals/route.ts` — Goals CRUD (GET/POST/DELETE), one goal per metricKey
- `app/api/training/history/route.ts` — Per-exercise history (all sets, personal best) for drawer
- `lib/integrations/_shared/` — Shared helpers (base URL, draft type, dedup import) used by every provider
- `lib/integrations/{strava,garmin,healthkit,healthconnect}/` — Provider-specific OAuth/auth, API/ingest, mapping
- `app/api/integrations/{strava,garmin}/{authorize,callback,status,disconnect,activities,import}/route.ts` — OAuth provider endpoints
- `app/api/integrations/{healthkit,healthconnect}/{connect,status,disconnect,ingest,activities,import}/route.ts` — Pairing-token provider endpoints (companion app pushes via `/ingest` with Bearer token)
- `components/goals/GoalsPanel.tsx` — Modal panel for viewing/adding/deleting goals with progress bars and ETAs
- `components/training/ExerciseHistoryDrawer.tsx` — Exercise history modal with personal best, weight/volume progression charts, all-time log
- `app/api/events/route.ts` — Event tag CRUD
- `app/api/streaks/route.ts` — Per-module streak calculation + 30-day coverage
- `app/api/import/route.ts` — CSV import (auto-detects module from headers)
- `app/api/export/route.ts` — CSV export per module or all
- `app/api/backup/route.ts` — SQLite backup to `prisma/backups/`
- `components/shared/EventBanner.tsx` — Active event banner (shown on weight page)
- `components/weight/WeightTrend.tsx` — 30-day chart with confidence-weighted history list and expandable explanation panels

## Running the App

```
npm run dev
```

Runs on port 5000 at `0.0.0.0` for Replit compatibility.

## Database

Prisma schema at `prisma/schema.prisma`. SQLite database at `prisma/dev.db`.

To apply schema changes:
```
npx prisma db push
```

## Package Manager

npm (`package-lock.json`)
