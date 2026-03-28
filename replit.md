# My Pens App

A personal health tracking Next.js application — an interpretation layer between raw trackers and everyday users.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: SQLite via Prisma ORM (`prisma/dev.db`)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts

## Modules

- **Weight** (`/weight`): Scale readings with full v3 water retention model (creatine, alcohol, glycogen, sodium, hard training). Per-entry confidence scoring, EWMA baseline trend, outlier detection, dynamic uncertainty band.
- **Food** (`/food`): Meal logging with macros (protein, carbs, fat, fiber). Preset-based quick entry.
- **Sleep** (`/sleep`): Bedtime/wake tracking with HRV and quality scores. 30-day trend.
- **Training** (`/training`): Exercise sets/reps/weight logging, auto-calculated volume.
- **Measurements** (`/measurements`): Body tape measurements with delta tracking.
- **Events** (`/events`): Trip/event tagging (travel, illness, holiday, diet-break, competition, other). Active events shown as banners on weight page and dashboard.
- **Dashboard** (`/dashboard`): Weekly overview with structured insight cards (positive/info/warning), real confidence data, logging streaks widget, CSV export, CSV import, and database backup.
- **Data Health** (`/data-health`): 30-day logging calendar heatmap per module, current streaks, longest streaks, and coverage percentages.

## Key Files

- `lib/retentionModels.ts` — Core water retention model, confidence scoring, EWMA trend, dynamic band, outlier detection
- `lib/db.ts` — Prisma singleton
- `app/api/weight/route.ts` — Weight POST (calculates breakdown) + GET (enriched with v3 trend layer)
- `app/api/dashboard/route.ts` — Dashboard aggregation with structured insights and real confidence data
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
