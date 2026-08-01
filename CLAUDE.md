# MY PENS — Claude Code Project Context

## What this is
MY PENS is a personal health tracking platform. Next.js web app + Expo mobile companion. Single-user. No social features. Full data ownership.

**Repo:** https://github.com/jeromio1987/mypens  
**Hosted:** Vercel (web) + Supabase eu-west-1 (database)  
**Mobile:** `mypens-mobile/` sibling directory (Expo managed workflow)

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) — see AGENTS.md for breaking-change warning |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| ORM | Prisma → PostgreSQL (Supabase project ID: eiyyblruwqqfrdroerhk, eu-west-1) |
| Charts | Recharts |
| Icons | Lucide React |
| Mobile | Expo managed workflow, expo-router v6, TypeScript |
| AI | Anthropic Claude (claude-sonnet-4-6) via `@anthropic-ai/sdk` |

---

## Dev server

```
npm run dev          # starts on port 5000 (not 3000)
http://localhost:5000
```

Health check: `GET /api/health` — confirms `hasAnthropicKey`, `hasMobileToken`, `hasDatabaseUrl`.

Local no-password access: set `MYPENS_AUTH_DISABLED=true` in `.env` (skips session/password in `proxy.ts`; leave unset/false on Vercel).

---

## File structure rules

- **All API routes:** `app/api/` (App Router — no `pages/api/`)
- **All pages:** `app/` directory, not `pages/`
- **Shared types:** `types/` or co-located with the feature
- **Mobile:** entirely in `mypens-mobile/` — separate repo clone, shares Supabase backend
- **Prototypes:** `prototypes/` — HTML experiments, not production code

---

## Database

Always read `prisma/schema.prisma` before any schema-related work.

```
npx prisma migrate dev --name <name>    # after schema changes
npx prisma generate                     # after pulling schema
npx prisma studio                       # GUI browser at :5555
```

Never rename or drop columns without checking all API routes that reference them.

---

## Critical files — do not touch without understanding

| File | Rule |
|------|------|
| `lib/retentionModels.ts` | Weight retention engine — do not modify logic; only extend with new confounder models |
| `lib/supabase.ts` | Uses lazy Proxy pattern — do NOT replace with direct `createClient()` calls |
| `prisma/schema.prisma` | Read this first before any data-layer changes |

---

## UI patterns

- Page backgrounds: `bg-pens-deep` (dark navy)
- Cards: `rounded-2xl` navy cards
- Each module has its own accent colour — respect the established colour system

### Module accent colours

| Module | Colour |
|--------|--------|
| Weight | Emerald |
| Food | Amber |
| Sleep | Indigo |
| Training | Orange |
| Measurements | Purple |
| Journal | Pink |
| Anchor | Slate (private — do not describe in public-facing docs) |
| Verdict | Blue |
| Clubroom | Gold |
| Dopamine | Cyan |

---

## Built modules (do not rebuild)

Weight · Food · Sleep · Training · Body Measurements · Journal / Mood · Events & Streaks · Anchor (private) · Verdict (rule-based audit + AI weekly summary) · Clubroom (medals, tiers, weekly wrap) · Dopamine Router

**Integrations built:** Garmin OAuth + webhook · Strava OAuth + webhook · Apple HealthKit · Android Health Connect · Tanita CSV import · CSV export

---

## Not built yet (Phase 2+)

- Per-pillar AI breakdown in Verdict (summary is live; per-pillar is not)
- Multi-user / social features — intentionally excluded from v1
- Phase 5-D/E polish — offline HTML snapshot parity with cockpit visual language
- Phase 6-E — optional AI narrative on deterministic planner JSON
- **Phase 7 — Experiment Engine & Food as Confounder** (year-one flagship) — food as causal pillar; timed experiments with auto-verdict (supported / weak / confounded); closes signal → cause → plan → proof

**Shipping / in progress:** Engine Report Cockpit (`/period-review`), Adaptive Sports Planner (`/planner` + Expo week card + food soft-rules 6-D), RHR drinking ladder (≥50 / ≥55)

Programme builder (2-C) and weekly PDF (2-D) are **built** — do not rebuild; extend only.
---

## Mobile bridge (Expo ↔ API)

**Daily phone = Vercel** (`https://mypens.vercel.app`). Local Next `:5000` is for **agents only**.

```env
# mypens/.env (+ Vercel env — must match)
MOBILE_PENS_API_TOKEN=<shared-secret>

# mypens-mobile/.env (baked into APK — rebuild after change)
EXPO_PUBLIC_PENS_API_URL=https://mypens.vercel.app
EXPO_PUBLIC_PENS_API_TOKEN=<same-as-above>
```

Agents temporary LAN override: `EXPO_PUBLIC_PENS_API_URL=http://<LAN-IPv4>:5000`. See `docs/COWORKER-SETUP.md` / `docs/DEV-SERVER-RULES.md`.

---

## Tool delegation

| Task | Owner |
|------|-------|
| All code (web + mobile) | Cursor |
| Specs, copy, PRD | Enterprise GPT |
| Strategy, review, memory | Claude (this session) |

Do not rewrite working modules from scratch. Read existing code before making changes.

**Ship / APK:** every Cursor build needs an **adversarial wiring pass** before APK — not a one-time cleanup. Run `node .cursor/skills/mypens-adversarial-pre-apk/scripts/wiring-check.mjs`, then verify-ship. See `docs/AUDIT-PLAYBOOK.md` and `.cursor/rules/mypens-finish-the-wiring.mdc`.
