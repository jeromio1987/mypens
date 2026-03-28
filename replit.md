# My Pens App

A personal health tracking Next.js application.

## Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: SQLite via Prisma ORM (`prisma/dev.db`)
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts

## Modules

- **Weight**: Scale readings with body composition metrics and water retention modelling
- **Food**: Meal logging with macros
- **Sleep**: Bedtime/wake tracking with HRV and quality scores
- **Training**: Exercise sets/reps/weight logging
- **Measurements**: Body tape measurements
- **Dashboard**: Aggregated views across all modules

## Running the App

```
npm run dev
```

Runs on port 5000 at `0.0.0.0` for Replit compatibility.

## Database

Prisma schema lives in `prisma/schema.prisma`. The SQLite database file is at `prisma/dev.db`.

To apply schema changes:
```
npx prisma db push
```

To regenerate the Prisma client after schema changes:
```
npx prisma generate
```

## Package Manager

npm (see `package-lock.json`)
