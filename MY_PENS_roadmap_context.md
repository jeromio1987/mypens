# MY PENS – Multidimensional Roadmap (Context for AI sessions)

> ⚠️ **SUPERSEDED — Do not use this file as session context.**  
> The master roadmap is at `C:\Users\jerom\Desktop\claude\mypens-master-roadmap.md`.  
> This file is kept for reference only and is no longer updated.

---

## North Star / Positioning

- **Product:** MY PENS — a weight/health tracking interpretation layer
- **North star:** Become the trusted interpretation layer between raw trackers and everyday users
- **Target user:** Ordinary people who like tracking + slightly sportive users who want signal, not jargon
- **Sequencing rule:** Trust first → Convenience → Scale
- **Not:** hardcore biohackers / broad wellness feed
- **Is:** a premium daily utility

---

## Roadmap Architecture — 4 Phases

| Phase | Name | Timing | Goal |
|-------|------|--------|------|
| 1 | Foundation | Week 1 | Prove the core fast |
| 2 | Trust MVP | Weeks 2–3 | Make daily use feel good |
| 3 | Convenience | Weeks 4–6 | Add convenience without clutter |
| 4 | Scale & Monetize | Later, if earned | Expand only when earned |

**Strategic call:** One app, two depths (simple by default, advanced by choice). Do NOT split into two apps yet.

---

## Phase Deliverables

### Phase 1 – Foundation
- Canonical data model, editable daily log, adjustment logic v1, trip/event tagging, basic proof dataset

### Phase 2 – Trust MVP
- Simple mobile flows, confidence level, explanation cards, export/import basics, privacy baseline live

### Phase 3 – Convenience
- Health brokers, Strava direct sync, better onboarding, reminders and nudges, retention instrumentation

### Phase 4 – Scale & Monetize
- Premium insights, optional hosted sync, Garmin review, partner pilots, refined monetization

---

## Track 1 – Development

**Core objective:** Create one canonical timeline of user data, then layer interpretation on top. Every data point preserves source, editability and confidence.

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 – Foundation | Data foundation | Canonical schema (weight, events, workouts, notes), manual entry with edit history, source provenance tags, import mapping |
| 2 – Trust MVP | Interpretation engine | Adjustment logic v1 with visible assumptions, confidence layer, explanation snippets, backtest harness |
| 3 – Convenience | Quality & analytics | Event attribution review tools, internal QA dashboards, retention and usage instrumentation |
| 4 – Scale & Monetize | Scalable architecture | Modular sync/insights boundaries, premium-ready feature flags, selective hosted infra |

**Success looks like:** Stable engine explaining noisy weigh-ins. Reliable source provenance. Clean rule for local vs remote.

---

## Track 2 – Mobile + Design

**Experience goal:** Light, calm, understandable for ordinary trackers. Reduce interpretation anxiety.

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 – Foundation | Flow design | Mobile-first entry/review/edit, home screen (today + trend + explanation), trip/event mode |
| 2 – Trust MVP | Trust surfaces | Confidence meter, adjusted-vs-raw comparison, explanation cards, "what changed / what matters" hierarchy |
| 3 – Convenience | Retention polish | Reminders, streaks, nudges, saved habits, one-tap event tagging, better empty states |
| 4 – Scale & Monetize | Premium UX depth | Advanced filters, source controls, longer-view reports, multi-device sync settings |

**Success looks like:** User logs in seconds. Post-trip moment feels reassuring. App teaches without feeling technical.

---

## Track 3 – Legal + Data Governance

**Governance goal:** Informed consent, minimal data collection, clear vendor boundaries, conservative health-adjacent handling.

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 – Foundation | Baseline readiness | Privacy policy, terms, in-app consent flows, health disclaimer, data map and retention logic |
| 2 – Trust MVP | Compliance depth | GDPR review, controller/processor mapping, DPIA-style risk review, incident response and deletion |
| 3 – Convenience | Integration guardrails | Review Apple/Google broker permissions, Strava/vendor terms matrix, no scraping |
| 4 – Scale & Monetize | Expansion readiness | Counsel review before direct health integrations, partner-grade handling, hosted sync security audit |

**Success looks like:** Users understand what's collected. Vendor terms don't force brittle workarounds. Privacy is a trust advantage.

---

## Track 4 – Branding + Go-to-Market

**Brand objective:** Position MY PENS as a premium interpretation product — not a generic wellness app, not a biohacker toy.

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 – Foundation | Message foundation | Refine promise (raw weight vs useful signal), audience language, landing page, first proof story |
| 2 – Trust MVP | Narrative fit | Trip rebound walkthrough, before/after screenshots, trust language (no pseudo-science) |
| 3 – Convenience | Acquisition loops | Creator/coach seeding, referral hooks, email onboarding, habit education |
| 4 – Scale & Monetize | Commercial framing | Clear free vs paid structure, partnership stories, investor-ready traction narrative |

**Success looks like:** A stranger understands the value in one sentence. First users know whether it's for them.

---

## Track 5 – Integrations

**Integration rule:** Manual first. One internal data model. External sources suggest data into it. Users stay in control.

| Phase | Focus | Deliverables |
|-------|-------|-------------|
| 1 – Foundation | Manual first | ✅ Fast manual entry (weight + body metrics), ✅ Tanita CSV import (`/import-tanita`, `lib/tanitaCsv.ts`), source labels + override rules, CSV export (pending) |
| 2 – Trust MVP | Broker integrations | ✅ Apple HealthKit + Android Health Connect schemas + pairing + push ingestion, ✅ cross-source provenance on TrainingEntry, ✅ PushedWorkout review inbox |
| 3 – Convenience | Direct convenience | ✅ Strava OAuth + webhook + live sync, ✅ Garmin OAuth + activity ping + bulk .fit import, ✅ SkippedWorkout tombstones for de-dup |
| 4 – Scale & Monetize | Selective expansion | Tanita direct API (CSV route now live as Phase 1 substitute), deeper vendor deals only when retention supports it |

**Success looks like:** High-value import coverage. Clear source trust hierarchy. Integrations support the wedge — don't bloat the product.

---

## Strategic Call — One App, Two Depths

**Recommended structure:**
- Default mode: easy tracking, clear explanations, low setup
- Advanced mode: local-first controls, deeper source management, richer reports
- Optional hosted sync later: convenience layer, not a second identity

**Why not split now:** avoids duplicate overhead, keeps brand tight, prevents early audience confusion.

**When to reconsider:** if enterprise/white-label emerges, if privacy-first users need very different economics, or if hosted sync becomes the dominant entry point.

---

## Build Status — May 2026

The codebase is ahead of the roadmap document. Actual state by track:

| Track | Roadmap Phase | Actual State |
|-------|--------------|-------------|
| 1 – Dev | Phase 1–2 | ✅ Schema complete (WeightEntry + confounders, Food, Sleep, Training, Events, Goals, Body Measurements). ✅ Adjustment engine v3 (creatine/alcohol/glycogen/sodium/hardTraining models, EWMA rolling baseline, dynamic volatility band, outlier detection). ✅ Confidence layer (high/medium/low, uncertainty band). Backtest harness pending. |
| 2 – Mobile/Design | Phase 1 | Mobile companion clients exist (`mobile-companions/`, `my-pens-mobile-test/`). Trust surface UI (confidence meter, explanation cards visible in weight module). Trip/event tagging page at `/events`. CSV export UI pending. |
| 3 – Legal | Pre-Phase 1 | `threat_model.md` drafted. Privacy policy, terms, in-app consent flows not yet shipped. |
| 4 – Brand/GTM | Pre-Phase 1 | Name and design language established (PENS navy theme). Landing page and proof story not yet published. |
| 5 – Integrations | Phase 2–3 | ✅ Tanita CSV import. ✅ Strava OAuth + webhook. ✅ Garmin OAuth + ping + .fit bulk import. ✅ Apple HealthKit + Android Health Connect pairing + ingestion. ✅ PushedWorkout review inbox. CSV export pending. |

---

## Next Priorities (updated May 2026)

1. **CSV export** — complete the Phase 1 import/export pair (weight + body metrics as downloadable CSV)
2. **Privacy baseline** — ship privacy policy, terms, and in-app consent screen before any external users
3. **Explanation cards** — surface the adjustment engine reasoning to the user in plain language (trust surface)
4. **Backtest harness** — validate the adjustment models against historical data
5. **Mobile trust loop polish** — morning reading prompt, post-trip reassurance flow
6. **Monetization model** — define free vs paid tiers before any go-to-market work

---

## AI Parallel Workstreams

### What Cursor should work on
Cursor is best suited for implementation tasks with clear scope. Current open items:

- **CSV export endpoint + UI** — `POST /api/export/weight` returning CSV, download button on `/weight`. Pair with existing import.
- **Explanation card component** — a reusable `<ExplanationCard>` that takes a `WeightBreakdown` (from `lib/retentionModels.ts`) and renders plain-language reasoning. Already wired in the model; needs the UI.
- **Backtest harness** — a script or internal page (`/data` or `/verdict`) that replays historical `WeightEntry` rows through `calculateWeightBreakdown()` and shows predicted vs actual drift.
- **Source label UI on weight entries** — surface `tanitaReliable`, `morningReading`, and active confounders as readable badges on the weight log.
- **Event attribution panel** — on `/weight`, when a date falls within an `EventTag` range, surface an inline banner explaining expected scale behaviour (similar to `EventBanner` component but inline in the trend).
- **Empty state flows** — `/weight`, `/sleep`, `/training` empty states that guide a first-time user through logging their first entry (onboarding completion).

### What ChatGPT Enterprise should work on
ChatGPT Enterprise is best for writing, strategy, and structured thinking — not code:

- **Privacy policy + terms of service** — draft for a single-user local health app (GDPR-framed, EU user). Reference the `threat_model.md` already in the repo for data flows. Needs: data collected, retention, deletion rights, no-third-party-sale clause, health data disclaimer.
- **In-app consent copy** — short, plain-English consent screen text for first launch. Must cover health data, local storage only, what "adjustment" means.
- **Explanation copy library** — write the plain-language strings for each adjustment type (creatine, alcohol, glycogen, sodium, hard training, flight, illness) to be used in explanation cards. One sentence per scenario, e.g. "You trained hard yesterday — your muscles are holding ~0.3 kg of water from inflammation."
- **Monetization model** — define free vs paid tiers. Given the roadmap (personal utility, premium daily use), draft options: one-time purchase vs subscription vs freemium. Include price point rationale.
- **Landing page copy** — one-sentence promise, three-bullet value prop, one proof story (e.g. the post-trip rebound walkthrough). Match the anti-jargon tone of the roadmap.
- **DPIA-style risk review** — structured risk table: data category × risk × mitigation × residual risk. Based on the schema (health data, recovery/substance data in the Anchor module which is the most sensitive).
- **MVP scope cut** — given everything built, write a crisp definition of what the minimum viable external-facing version is. What must work, what can be hidden behind a flag, what can be cut entirely for v1.

---

## What This Roadmap Does NOT Yet Cover (gaps to fill)

- [ ] **Monetization model** — freemium tiers not yet defined (what's free, what's paid, price points) → ChatGPT Enterprise
- [x] ~~**Data model spec**~~ — canonical schema fully designed and migrated
- [x] ~~**Adjustment logic spec**~~ — adjustment engine v3 live in `lib/retentionModels.ts`
- [ ] **MVP scope cut** — Phase 2 deliverables are still broad; what is the absolute minimum to ship? → ChatGPT Enterprise
- [x] ~~**Design language**~~ — PENS navy theme established and applied consistently
- [ ] **Name / domain** — is "MY PENS" final? Is a domain available?
- [ ] **Metrics / success KPIs** — retention targets, engagement benchmarks not defined
- [ ] **Privacy / legal baseline** — policy, terms, consent not yet shipped → ChatGPT Enterprise
- [ ] **Tech stack decision for native mobile** — companion clients exist but React Native vs native not locked

---

*Roadmap version: updated May 2026 — reflects actual build state*
