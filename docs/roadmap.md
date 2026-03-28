# MY PENS – Multidimensional Roadmap (Context for AI sessions)

> Use this file as context at the start of any new Claude or ChatGPT session.
> Paste it in full and say: "This is my current roadmap. I want to continue working on it."

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
| 1 – Foundation | Manual first | Fast manual entry (weight + body metrics), CSV import/export basics, source labels and override rules |
| 2 – Trust MVP | Broker integrations | Apple HealthKit + Android Health Connect (read only), cross-source mapping (workouts, sleep, weight) |
| 3 – Convenience | Direct convenience | Strava direct for workouts/context, Garmin evaluated post-broker, import review screens for duplicates |
| 4 – Scale & Monetize | Selective expansion | Tanita via approved route, deeper vendor deals only when retention supports it |

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

## Next 30 Days (Priority Order)

1. Lock core schema and adjustment v1
2. Polish the mobile trust loop and trip flow
3. Ship privacy baseline and review pack
4. Start HealthKit / Health Connect evaluation

---

## What This Roadmap Does NOT Yet Cover (gaps to fill)

- [ ] **Tech stack decisions** — what language/framework for mobile? React Native? Swift/Kotlin native?
- [ ] **Solo vs team** — who is building this? Are you coding it yourself or directing AI/developers?
- [ ] **Monetization model** — freemium tiers not yet defined (what's free, what's paid, price points)
- [ ] **Data model spec** — the canonical schema is named but not designed (field names, types, relationships)
- [ ] **Adjustment logic spec** — "adjustment v1" is referenced but algorithm not defined
- [ ] **MVP scope cut** — Phase 2 deliverables are still broad; what is the absolute minimum to ship?
- [ ] **Design language** — no visual identity yet (colors, typography, UI tone)
- [ ] **Name / domain** — is "MY PENS" final? Is a domain available?
- [ ] **Metrics / success KPIs** — retention targets, engagement benchmarks not defined

---

*Roadmap version: revised — exported March 2026*
