# myPENS — local Next.dev rules (anti-wedge)

**Daily use = Vercel.** Open https://mypens.vercel.app (login → Food → Take photo). Local `npm run dev` on `:5000` is for **code agents only** — not for Jerome’s day-to-day logging. Phone APK must point `EXPO_PUBLIC_PENS_API_URL` at `https://mypens.vercel.app` (rebuild APK; Expo public env is baked at build time).

**Incident 2026-07-28:** Take photo failed because `:5000` was **wedged** (TCP listen OK, `/api/health` client-timed-out). Photo code was fine. Root pattern: **agent chaos on one shared Turbopack process**.

## Hard rules

1. **One next dev only** — port **5000**, project dir `mypens`. Never start a second on `:5001` for the same tree (they share `.next/dev` → Turbopack corruption: `Invalid code point …` on `globals.css`).
2. **Do not kill/restart from parallel agents.** If health fails: one owner checks → one kill → one `npm run dev`. No “unwedge” races.
3. **Do not flip `MYPENS_AUTH_DISABLED` mid-session** unless Jerome asks. Each flip forces a restart and multiplies zombies. Prefer `.env.local` once, restart **once**.
4. **Never `prisma migrate status` / migrate against pgbouncer `:6543`.** Use `DIRECT_URL` (`:5432`) or `prisma migrate diff`. Audit 7: migrate status hung **>15 min** on the pooler.
5. **Health gate before blaming photo.** `GET /api/health` must return in &lt;2s. If it times out: process is dead — restart once; do not “fix MIME”.
6. **Corrupt Turbopack cache:** stop **all** next processes, delete `.next/dev`, start **one** `npm run dev`. Do not clear cache while another next is still alive.

## Health watchdog (manual / agent)

```powershell
node scripts/dev-health.mjs
# optional LAN (phone path):
node scripts/dev-health.mjs http://192.168.0.235:5000
```

Cursor rule (always-apply): `.cursor/rules/mypens-dev-server-health.mdc` — restart alone is not a “foto-fix”.

`/api/health` already races Prisma `SELECT 1` at **1.5s** (`dbOk`/`dbMs`). A **full** client timeout means the **event loop is not servicing HTTP** — not a slow DB await.

## What Take photo needs

**Preferred (daily):** phone APK + browser → `https://mypens.vercel.app` (no local Next). `EXPO_PUBLIC_PENS_API_URL` must be that URL in the built APK.

**Agents only:** temporary LAN override of `EXPO_PUBLIC_PENS_API_URL` to `:5000` with a **live** Next. A zombie on 5000 looks like “camera broken” for the 11th time. It is not — and it must not be Jerome’s daily phone target.
