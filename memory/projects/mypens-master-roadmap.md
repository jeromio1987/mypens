# MY PENS — Master Development Roadmap

**Version:** Jul 2026 — pathways UX parked · synced to repo (`C:\Users\jerom\Desktop\claude\mypens`)  
**Repo:** https://github.com/jeromio1987/mypens  

## Session / infra status

**Done**

- Supabase project (eu-west-1)
- Tanita CSV import
- Full Expo mobile app under `mypens-mobile/` (Weight, Food, Sleep, Training, Measurements, Journal)
- Replit decommissioned — Cursor owns code
- `JournalEntry` in Prisma + web `/journal`
- Core modules, auth, wearables (Garmin, Strava, HealthKit, Health Connect), goals, streaks, events, backup, CSV, Anchor, Verdict, Clubroom, Dopamine router, PWA
- Habit pathways v0 (see Phase 3-E below) — **parked**

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
| Habit pathways v0 | `/dopamine` workspace (Focus · Log · Weekly); `GET /api/pathways`; Verdict `PathwayStatusChip`; strength from Anchor + Sleep. Focus in `localStorage`. **Parked — no further UX until unparked.** |

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
- [x] TASK 3-E Habit pathways v0 (shipped + **PARKED**) — see section below  

### Phase 4 — Scale

- [ ] TASK 4-A Clubroom multi-user (privacy-first, weekly wrap share)  
- [ ] TASK 4-B Garmin weight & sleep sync extensions  
- [ ] TASK 4-C Tanita direct via Apple Health body composition ingest  

---

## Habit pathways — PARKED (Jul 2026)

**Status:** v0 in tree · no active build · resume only when explicitly unparked.

**Product rule:** HTML dossier = science lab (frozen). myPENS Dopamine = daily UX. Verdict = status chip only.

| Piece | Location |
|-------|----------|
| Lab / teaching dossier | `Private/dopamine-adhd-dossier.html` (outside this repo) — zoom tone chart, pathway map, focus+local tags |
| UX wireframe | Cursor canvas `mypens-pathway-ux.canvas.tsx` |
| IM / commercial notes | `Private/state-platform-IM.html`, `Private/state-platform-financial-plan.html` |
| Dopamine workspace | `app/dopamine/page.tsx` + `components/pathways/PathwayWorkspace.tsx` |
| Verdict chip | `components/pathways/PathwayStatusChip.tsx` |
| Strength API | `app/api/pathways/route.ts`, `lib/pathways/*` |

**Parked next (do not start unless unparked)**

1. Persist weekly focus in DB (`RecoverySettings` or `UserSettings`) instead of `localStorage`  
2. Morning Brief one-liner from pathway focus  
3. Mobile (Expo) Focus · Log · Weekly parity  
4. Explicit cold/scaffold tags in Anchor UI (today: notes/supplements inference)  
5. Week-over-week strength delta on Weekly check  
6. Commercial Path A/B — only after personal loop sticky (see Private IM)

**Do not build while parked:** receptor dashboards, MDR/DTx, duplicate pathway UI on more pages, expanding the HTML dossier into an app shell.

---

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
5. Habit pathways — **parked** (Phase 3-E); unpark before any further pathway work  
6. Memory practice loop — **long-term only** (see § below); not a top-level module yet  

---

## Very long roadmap — bloodwork & physiology

**Principles:** education and self-tracking only (not diagnosis); easy mode by default; deep analysis opt-in; clinical packet export later.

- [ ] **Bloodwork v1 — ledger** — structured panels + markers over time (web `/bloodwork`, APIs, wearable context); OCR/import + doctor export still open.  
- [ ] **Bloodwork v2 — correlations** — food / training / sleep overlays with explicit uncertainty; Verdict narrator reads deterministic JSON only.  
- [ ] **7 — Wearable ↔ lab context panels** — For each draw date, show **context** (sleep, HRV if logged, training load in a fixed window before the draw): narrative framing is *“what else was happening in life/training”*, never implied causation. Garmin/HealthKit/Strava aggregates feed the same panel.  
- [ ] **9 — Longevity / prevention lens** — Separate UX tone: slower cadence, gentler defaults, **educational** suggested retest intervals by marker *class* (lipids, metabolic, iron, thyroid, etc.) with strong “ask your clinician” rails — no automated scheduling of real medical care.  
- [ ] **Easy vs deep** — One-tap summaries + optional raw tables, LOINC optional, personal baseline bands.  
- [ ] **Women’s health / cycle-aware labs** — opt-in high-privacy module (ties to cycle phases only when user logs them).  

---

## Very long roadmap — memory & cognition (parked)

**Status:** long-list only · **do not build** until habit pathways are unparked and sticky.  
**Advise (Jul 2026):** memory is trainable in parts (encoding, consolidation via sleep, prospective memory via scaffolds). It is a poor fit for a fake “hippocampus / memory %” visualization. Prefer sleep + Anchor honesty + external scaffolds over a brain-training theatre module.

**If / when built — keep tiny**

- [ ] **Memory practice loop (optional)** — not a top-level nav module; nest under Sleep or Dopamine  
- [ ] **One metric only** — e.g. streak of completed recalls or spaced items; optional “name 3 things from yesterday”  
- [ ] **Link to sleep / alcohol** — “last night’s sleep & drinks vs today’s forgetfulness” (correlation framing, never causation cosplay)  
- [ ] **Optional pathway framing** — build path: encode → protect sleep → recall (only if pathways unparked)  

**Do not build**

- Standalone Memory module with brain/hippocampus meters  
- Claims of measured synaptic / receptor improvement  
- Dual n-back as a core product (optional drill at most; small effect sizes)  

*Other product roadmaps (Investing Dashboard, Personal Cockpit, Jarvis, ISZE Dashboards) live in their own repos/paths — not duplicated here.*
