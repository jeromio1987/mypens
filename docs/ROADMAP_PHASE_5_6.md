# Cursor brief — Phases 5 · 6 · 7

**For:** Cursor  
**Date:** July 2026  
**Source of truth:** `memory/projects/mypens-master-roadmap.md`

North star loop: **signal → cause → plan → proof**

---

## Phase 5 — Engine Report Cockpit

- **The Read** · tabs · zoomable `/period-review` · Form score + pillars  
- RHR ladder: **≥50** likely drinking · **≥55** heavy stack  
- Offline HTML = snapshot only  

Build: **5-A → 5-E** (first cut of 5-A/B/C shipping on Phase 5–6 branch)

---

## Phase 6 — Adaptive Sports Planner

- Goal-driven week from sleep + sport load + food context  
- Sports: running · cycling · core · gym  
- Long session **Sat or Sun only**  

Build: **6-A → 6-F** (first cut of 6-A/B/C shipping)

---

## Phase 7 — Experiment Engine & Food as Confounder *(year-one flagship)*

Closes the loop: Cockpit explains, Planner proposes, **Experiments prove**.

### Food as confounder
- Rolling protein / kcal vs training load (energy-availability proxy — never medical)  
- Hard session on low-fuel day → Cause + planner bias  
- Alcohol × meal timing × next RHR ≥50/≥55 as one stack  
- Missing food logs → lower confidence, never block  

### Experiment
- User hypothesis + 2–6 week window + primary metric + guardrails  
- Deterministic verdict: **supported | weak | confounded | inconclusive**  
- Optional Claude prose on `verdictJson` only  

### Build order
**7-A** Food daily aggregates → **7-B** Food into Cause/The Read → **7-C** Experiment schema → **7-D** Verdict engine + tests → **7-E** `/experiments` UI → **7-F** Accept-week → adherence → Cockpit chip  

### Do not
- Modify `lib/retentionModels.ts`  
- Invent meal plans or diagnoses  
- Start 7 before 5–6 food soft-rules (6-D) unless explicitly combined  

---

## Open decisions

1. Default long day: Saturday vs Sunday?  
2. Accept week → Programme (2-C) vs `PlannerWeek` only?  
3. Default experiment length (28 days?) and required primary metrics per goalKind  
4. Protein floor default for body-comp experiments (e.g. 160g?) — user-set vs suggested  
