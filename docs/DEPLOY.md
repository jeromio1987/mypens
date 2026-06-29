# MY PENS — production deploy checklist

**Last updated:** 2026-06-29

## Pre-flight

1. `npx prisma migrate status` — all migrations applied locally
2. `npm run build` — clean production build
3. `npm run lint` — no errors
4. Confirm `.env` is **not** tracked (`git check-ignore .env`)

## Supabase (production DB)

```bash
npx prisma migrate deploy
```

Required for: `JournalEntry`, investing hub tables, `cross_app` writer (raw SQL in `lib/crossAppWriter.ts`).

## Vercel

1. Project linked to `github.com/jeromio1987/mypens`
2. Env vars (Production): `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_*`, `SUPABASE_*` as needed
3. Deploy: push `main` or `vercel --prod`
4. Post-deploy: hit `/api/health` and log one sleep row → verify `cross_app.daily_snapshot` updates

## Mobile (`mypens-mobile/`)

- `EXPO_PUBLIC_SUPABASE_URL` + anon key match production
- `MOBILE_PENS_API_TOKEN` matches Vercel env if API routes are token-gated

## Cross-app (Cockpit + Investing)

After deploy, writers run in production:

| Writer | Trigger |
|--------|---------|
| `lib/crossAppWriter.ts` | sleep / weight / journal save |
| Investing `POST /cron/daily-cross-app` | 17:30 trading days (Railway cron) |

Run cockpit migration once: `Projects/cockpit/cross_app_sync_migration.sql` (or `scripts/apply_cross_app_migration.py`).

## Done when

- [ ] Production schema matches `prisma/migrations/`
- [ ] Web live on Vercel
- [ ] Cockpit shows live sleep/regime row (not placeholders)
- [ ] `/morning-brief` loads on production URL
