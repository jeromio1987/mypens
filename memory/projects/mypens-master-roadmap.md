# MY PENS — Master Development Roadmap

**Version:** May 2026 — synced to repo audit (`C:\Users\jerom\Desktop\claude\mypens`)  
**Repo:** https://github.com/jeromio1987/mypens  

## Session / infra status

**Done**

- Supabase project (eu-west-1)
- Tanita CSV import
- Full Expo mobile app under `mypens-mobile/` (Weight, Food, Sleep, Training, Measurements, Journal)
- Replit decommissioned — Cursor owns code
- `JournalEntry` in Prisma + web `/journal`
- Core modules, auth, wearables (Garmin, Strava, HealthKit, Health Connect), goals, streaks, events, backup, CSV, Anchor, Verdict, Clubroom, Dopamine router, PWA

**Ops / handover**

- Run `npx prisma migrate dev` (or deploy migrations) if `JournalEntry` / programme models not yet on production DB
- Deploy to Vercel when you want Morning Brief + mobile API off localhost

## True current state (codebase)

**Implemented in tree**

| Area | Notes |
|------|--------|
| Programme builder (Phase 2-C) | Prisma `Programme` / `ProgrammeDay` / `ProgrammeExercise` (cuid ids, `weightKg`). `app/programmes/page.tsx`, CRUD under `app/api/programmes/`. Training: active programme + day picker prefills `TrainingEntry` queue. |
| Weekly PDF (Phase 2-D) | `@react-pdf/renderer`, `app/api/report/weekly/route.ts`, `components/report/WeeklyPdfDocument.tsx`, Dashboard download behind premium gate. |
| AI Verdict | `app/api/verdict/summary/route.ts` + Verdict UI |
| Exercise history per exercise | `app/training/exercise/[name]/` + API |
| Sleep debt | Sleep page components |
| Premium scaffold | `UserSettings.tier`, gates on Verdict / PDF / programme |
| Morning brief | `app/morning-brief/page.tsx`, API route |
| Landing / onboarding | Routes exist (`/landing`, `/onboarding`); verify copy vs `LANDING_PAGE_COPY.md` |

**Polish / backlog**

- Programme UI: reorder days/exercises via drag-and-drop (currently add/delete only)
- AI Verdict: deepen prompts / caching strategy as needed
- Phase 4: Clubroom multi-user, Garmin weight+sleep depth, Tanita via HealthKit body comp fields

## Phase checklist (MY PENS)

### Phase 1 — Immediate gaps

- [x] TASK 1-A Tanita CSV import  
- [x] TASK 1-B Mood & Journal module  
- [x] TASK 1-C Full mobile app (Expo)  

### Phase 2 — Feature expansion

- [x] TASK 2-A AI-powered Verdict upgrade  
- [x] TASK 2-B Exercise history per exercise  
- [x] TASK 2-C Workout programme builder (core CRUD + Training pre-fill — optional DnD reorder)  
- [x] TASK 2-D Weekly PDF report  
- [x] TASK 2-E Sleep debt tracker  

### Phase 3 — Platform & product

- [x] TASK 3-A Documentation overhaul (verify docs folder vs product)  
- [ ] TASK 3-B Onboarding — confirm build matches final copy  
- [x] TASK 3-C Premium feature scaffold  
- [ ] TASK 3-D Landing page — confirm build matches `LANDING_PAGE_COPY.md`  

### Phase 4 — Scale

- [ ] TASK 4-A Clubroom multi-user (privacy-first, weekly wrap share)  
- [ ] TASK 4-B Garmin weight & sleep sync extensions  
- [ ] TASK 4-C Tanita direct via Apple Health body composition ingest  

## UI note — `/context` bottom bar

Four slots only: **Weight · Food · Sleep · Journal** (overview remains in “Quick Access Entries”, not the tab bar).

## Delegation matrix

| Tool | Role |
|------|------|
| Cursor | Next.js web + Expo mobile — implementation |
| Enterprise GPT | Specs, documentation, research, long-form copy |
| Claude | Strategy, review, memory, connecting outputs |

## Remaining work summary (prioritised)

1. Production migrations + Vercel deploy  
2. Landing + onboarding QA against copy decks  
3. Programme builder: optional drag reorder  
4. Phase 4 integrations and Clubroom  

---

## Very long roadmap — bloodwork & physiology

**Principles:** education and self-tracking only (not diagnosis); easy mode by default; deep analysis opt-in; clinical packet export later.

- [ ] **Bloodwork v1 — ledger** — structured panels + markers over time (web `/bloodwork`, APIs, wearable context); OCR/import + doctor export still open.  
- [ ] **Bloodwork v2 — correlations** — food / training / sleep overlays with explicit uncertainty; Verdict narrator reads deterministic JSON only.  
- [ ] **7 — Wearable ↔ lab context panels** — For each draw date, show **context** (sleep, HRV if logged, training load in a fixed window before the draw): narrative framing is *“what else was happening in life/training”*, never implied causation. Garmin/HealthKit/Strava aggregates feed the same panel.  
- [ ] **9 — Longevity / prevention lens** — Separate UX tone: slower cadence, gentler defaults, **educational** suggested retest intervals by marker *class* (lipids, metabolic, iron, thyroid, etc.) with strong “ask your clinician” rails — no automated scheduling of real medical care.  
- [ ] **Easy vs deep** — One-tap summaries + optional raw tables, LOINC optional, personal baseline bands.  
- [ ] **Women’s health / cycle-aware labs** — opt-in high-privacy module (ties to cycle phases only when user logs them).  

*Other product roadmaps (Investing Dashboard, Personal Cockpit, Jarvis, ISZE Dashboards) live in their own repos/paths — not duplicated here.*
