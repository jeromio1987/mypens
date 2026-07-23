# MY PENS — Master Development Roadmap

**Version:** July 2026 — Engine Cockpit / Adaptive Planner / Experiment+Food flagship  
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

### Phase 5 — Engine Report Cockpit

- [ ] TASK 5-A RHR drinking ladder (≥50 likely drinking · ≥55 heavy stack) + tests  
- [ ] TASK 5-B Period-review API with `from`/`to` window  
- [ ] TASK 5-C Tabbed `/period-review` — **The Read**, Form score, pillar charts, zoom brush  
- [ ] TASK 5-D Offline HTML snapshot export (no full zoom)  
- [ ] TASK 5-E Align analyze/stress HTML emitters with cockpit visual language  

### Phase 6 — Adaptive Sports Planner

- [x] TASK 6-A Goal model + UI (VO₂max / body-comp / marathon / custom) — first cut on cockpit/planner branch  
- [x] TASK 6-B Deterministic planner engine (sleep + sport load + weekend-long rule) — first cut  
- [x] TASK 6-C `/planner` week grid — running · cycling · core · gym switches — first cut  
- [ ] TASK 6-D Food-aware soft constraints  
- [ ] TASK 6-E Optional AI narrative on deterministic JSON only  
- [ ] TASK 6-F Mobile week card  

### Phase 7 — Experiment Engine & Food as Confounder

- [ ] TASK 7-A Food daily aggregates + energy-availability signals (protein/kcal vs training load)  
- [ ] TASK 7-B Wire Food into Cause / The Read / RHR stack (food × alcohol × next-morning RHR)  
- [ ] TASK 7-C `Experiment` model — hypothesis, window, primary metric, guardrails  
- [ ] TASK 7-D Experiment runner — adherence + auto verdict (supported / weak / confounded)  
- [ ] TASK 7-E `/experiments` UI + link from Cockpit / Planner goals  
- [ ] TASK 7-F Closed loop — Accept week → adherence → experiment progress card  

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
3. **Phase 5 — Engine Report Cockpit** (ship + polish zoom / composition series)  
4. **Phase 6 — Adaptive Sports Planner** (food soft-rules, AI why, mobile card)  
5. **Phase 7 — Experiment Engine & Food as Confounder** (year-one flagship insight loop)  
6. Programme builder: optional drag reorder  
7. Phase 4 integrations and Clubroom / bloodwork track  

---

## Phase 5 — Engine Report Cockpit

**Status:** Spec locked Jul 2026 · partially prototyped (offline HTML stress report on branch `cursor/engine-analysis-test-d4c7`)  
**Primary surface:** `/period-review` (interactive) · offline HTML snapshot as export only  
**Top block name:** **The Read** (not “executive summary”)

### Product intent
One place to answer: *how am I doing, over which window, and what is the leading cause?*  
Interactive zoom recalculates tiles, graphs, The Read, and causal ranking for the selected range.

### Tabs (shared date range)

| Tab | Job |
|-----|-----|
| **The Read** | 4–6 lines: verdict, leading cause, top risk, top win, next action |
| **Timeline** | Zoomable Form score (0–100) + range presets / brush |
| **Body** | RHR, HRV, stress, sleep charts + threshold bands |
| **Training** | Garmin + Strava load, idle gaps |
| **Composition** | Tanita weight / BF% when present |
| **Cause** | Alcohol / idle / sleep-debt ranking with evidence |
| **Checks** | Engine pass/fail (stress-test / QA; collapsed by default) |

### RHR drinking ladder (encode in causal engine)

| Resting HR | Flag | User-facing meaning |
|------------|------|---------------------|
| ≤ 49 | `clean_band` | Not a drink signal by RHR alone |
| **≥ 50** (above 49) | `likely_drinking` | Definitely been drinking |
| **≥ 55** (above 54) | `heavy_stack` | Very bad — heavy drinking and/or other load |

Rules of engagement:
- Anchor `alcoholDrinks` (especially binge ≥10) remains **ground truth** when logged and outranks RHR-only guesses.
- Empty Anchor + consecutive mornings RHR ≥ 50 → escalate `likely_drinking`.
- RHR ≥ 55 + low steps/training → `heavy_stack` (not “fitness calm”).
- Low RHR (e.g. ~53) with **no** high-RHR mornings and no Anchor drinks → keep under-load / recovery-illusion path.

### Graphs (levels)

- **A — Form score:** single “how good was I doing?” series with green/amber/red bands  
- **B — Pillars:** sleep, stress, HRV, RHR (49/54 lines), steps, training load — shared x-axis with zoom  
- **C — Composition:** weight + BF% dual axis  
- **D — Cause evidence:** drink days / high-RHR mornings / zero-activity days in window  

### Build order

- [ ] **5-A** RHR drinking ladder in `periodCausal` + vitest  
- [ ] **5-B** API `GET /api/period-review?from=&to=` (or equivalent) returning daily series + window report  
- [ ] **5-C** Tabbed `/period-review` UI — The Read + Form score + pillar charts + range brush (Recharts)  
- [ ] **5-D** Offline HTML export snapshot (same visual language; **no** full interactive zoom)  
- [ ] **5-E** Wire stress-test / live analyze runners to emit the new HTML shape  

**Decision:** full zoom lives in the Next app, not in a giant offline HTML file.

---

## Phase 6 — Adaptive Sports Planner

**Status:** Spec Jul 2026 · **first cut shipping** (`/planner`, `PlannerGoal`, `planWeek`) on Phase 5–6 branch · deepen 6-D/E/F next  
**Depends on:** Training + Sleep ledgers (live); Food logging (user tracks; planner reads intake when present); Garmin/Strava history preferred  
**Distinct from:** static Programme builder (2-C) — that is a fixed template. This is a **dynamic week planner** that adapts to recovery and goal.

### Product intent
Propose the next training week (or rolling 7–14 days) from:
- how much sport was already done (and **which** sport)
- sleep quality / debt
- optional food context (energy availability — not a full diet coach)
- a user-declared **goal**
- hard preference: **long session only on Saturday or Sunday**

### Sports the user can switch between

| Mode | Notes |
|------|--------|
| Running | Easy / tempo / long — long locked to Sat **or** Sun |
| Cycling | Endurance / intervals — same weekend-long rule |
| Core | Short recovery-friendly sessions mid-week |
| Gym (lifting) | Push/pull/legs or upper/lower; volume from recent Strava/manual ledger |

User can enable a mix (e.g. gym + one weekend long run) — planner must not stack two long sessions in one week unless explicitly overridden.

### Goals the user must declare (examples)

Planner does not invent the goal — user picks / writes one, e.g.:

- **VO₂max → 50** (or other target number)  
- **~13% body fat without losing muscle** (uses Tanita BF% + training volume; food intake informs deficit vs refeed days)  
- **Run a marathon** (builds long-run progression; Saturday/Sunday long only)  
- Future: race date, 5K/10K PB, strength milestone  

Goal → plan bias:
- VO₂max → more quality aerobic + controlled gym; protect sleep  
- Body-comp → gym priority + protein/calorie context from Food; avoid junk volume when sleep is poor  
- Marathon → progressive long run on chosen weekend day; mid-week easy run/cycle; gym maintenance  

### Inputs (read-only from existing modules)

- SleepEntry / sleep debt  
- GarminActivity + TrainingEntry (Strava/manual) by sport  
- WeightEntry / Tanita BF% when present  
- FoodEntry totals (kcal/protein) when logged — soft constraint, never block the plan if missing  
- Optional Anchor recovery flags (heavy drink day → force easy / rest next day)

### Outputs

- Week grid: Mon–Sun with sport, duration/intensity band, and **why** (one line)  
- “Long day” locked to Sat **or** Sun (user toggle)  
- Swap sport control per slot (running ↔ cycling ↔ core ↔ gym) with auto rebalance  
- “Accept week” → optional write into Programme / Training queue (reuse 2-C models where possible)  
- Mobile: read-only week card first; edit later  

### Build order

- [ ] **6-A** Goal model (`UserGoal` or `PlannerGoal`: type, target, raceDate?, notes) + settings UI  
- [ ] **6-B** Deterministic planner engine (pure functions + tests) — load from sleep/training; no LLM required for v1  
- [ ] **6-C** `/planner` web UI — week grid, weekend-long toggle, sport switches  
- [ ] **6-D** Food-aware soft rules (low protein / very low kcal → bias easier day; never medical advice)  
- [ ] **6-E** Optional Claude narrative layer (“why this week”) on top of deterministic JSON only  
- [ ] **6-F** Expo companion card  

### Explicit non-goals (v1)

- Not a full coaching marketplace  
- Not auto-booking calendar  
- Not medical / injury diagnosis  
- Does not replace Food logging — only consumes it  

---

## Phase 7 — Experiment Engine & Food as Confounder

**Status:** Spec locked Jul 2026 · year-one flagship insight · not built  
**Depends on:** Phase 5 Cockpit (The Read / Cause / zoom) · Phase 6 Planner goals · existing Food + Weight/Tanita + Anchor + RHR ladder  
**North star loop:** **signal → cause → plan → proof**

### Product intent
Stop treating goals as slogans. Every meaningful goal becomes a **time-bounded experiment** with a hypothesis, primary metric, guardrails, and an auto-verdict.  
Food stops being “another diary” and becomes a **first-class confounder** beside alcohol, sleep, and training — the missing input that makes weight, RHR, and session quality stop lying to each other.

### Why this is the flagship
Cockpit explains *what happened*. Planner proposes *what to do*.  
Phase 7 closes the loop: *did the plan + fueling actually move the metric — or was it confounded?*

That is the difference between a chart app and a **private operating system for your body**.

### Food as causal pillar (not a calorie coach)

| Signal | How it enters the engine |
|--------|---------------------------|
| Rolling protein g/day | Soft floor for body-comp / gym weeks |
| Rolling kcal vs training load | Energy-availability proxy (never medical advice) |
| Hard session on low-fuel day | Cause finding + planner bias next week |
| Alcohol × late meal × next RHR ≥50/≥55 | One stack in Cause / The Read |
| Photo/structured meals (existing friction) | Weekly “what I actually ate” line in The Read |

Rules:
- Missing food logs **never block** Cockpit or Planner — they lower confidence / add a “fueling unknown” tag.  
- Do **not** invent diets, meal plans, or diagnoses.  
- Do **not** modify `lib/retentionModels.ts` — food explains noise; the weight engine stays sacred.

### Experiment object

```text
Experiment
  goalKind          // vo2max | bodyfat | marathon | custom (ties to PlannerGoal)
  hypothesis        // one sentence, user-editable
  window            // startDate → endDate (2–6 weeks typical)
  primaryMetric     // e.g. bodyFatPct ↓ | Form avg ↑ | long-run minutes ↑ | VO2 proxy
  guardrails[]      // e.g. sleep avg ≥6.5 · RHR≥55 days ≤2 · gym volume not ↓ >15%
  planLink          // optional accepted PlannerWeek ids
  foodPolicy        // optional protein floor / kcal band (soft)
  status            // draft | running | completed | aborted
  verdict           // supported | weak | confounded | inconclusive
  verdictJson       // deterministic evidence pack
```

Example hypotheses (user-declared, system-scored):
- “Sun long only + ≥160g protein → BF% ↓ without gym volume ↓ over 4 weeks.”  
- “Two quality aerobic sessions/week + RHR clean-band mornings → Form avg ↑.”  
- “Marathon long progression Sat; mid-week easy only — long-run minutes ↑ without sleep crash.”

### Auto-verdict logic (deterministic first)

At window end (or on demand):

1. **Adherence** — % accepted plan days completed (sport/intensity match, soft).  
2. **Primary metric delta** — vs baseline window of equal length before start.  
3. **Guardrail breaches** — count + severity (RHR heavy days, sleep floor, muscle-proxy volume).  
4. **Confounder score** — binge days, travel/illness tags, food-log coverage.  
5. **Verdict**  
   - **supported** — metric moved in goal direction, adherence decent, confounders low  
   - **weak** — metric flat/noisy, adherence ok  
   - **confounded** — metric moved but binge / RHR≥55 cluster / tiny food coverage / illness  
   - **inconclusive** — not enough primary-metric samples  

Optional Claude layer: prose on top of `verdictJson` only (same pattern as Weekly Feedback / Verdict).

### Surfaces

| Surface | Job |
|---------|-----|
| `/experiments` | List, create from Planner goal, running/completed |
| Cockpit → The Read | “Active experiment: week 3/4 — adherence 71% — fueling unknown 2d” |
| Cause tab | Food × alcohol × RHR stack when relevant |
| Planner | “This week serves experiment X” banner |
| Weekly Feedback | Experiment progress card |
| Proof pack (later) | Season dossier: experiments + graphs + causes |

### Build order

- [ ] **7-A** Food daily aggregates API/helper (kcal, protein, meal count) + coverage %  
- [ ] **7-B** Food confounders into Cause / The Read / cockpit series tags  
- [ ] **7-C** Prisma `Experiment` (+ optional `ExperimentDay` adherence) + migration  
- [ ] **7-D** Deterministic verdict engine + vitest (supported / weak / confounded / inconclusive)  
- [ ] **7-E** `/experiments` UI — create from goal, progress, end-of-window verdict  
- [ ] **7-F** Closed loop: Accept week → adherence hooks → Cockpit experiment chip  

### Explicit non-goals (v1)

- Not a meal-plan generator or macro marketplace  
- Not clinical nutrition or medical advice  
- Not multi-user challenges  
- Not ML personalization until personal baselines (Layer C) exist and stay transparent  

### 1-year placement

| Horizon | Layer |
|---------|--------|
| Now | Phase 5–6: explain + plan |
| Next | **Phase 7: proof via experiments + food confounders** |
| Then | Personal baselines / readiness · seasonal Form · proof-pack export · bloodwork punctuation |

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
