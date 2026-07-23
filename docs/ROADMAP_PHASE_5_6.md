# Cursor brief — Phase 5 Engine Cockpit + Phase 6 Adaptive Sports Planner

**For:** Cursor  
**Date:** July 2026  
**Source of truth:** `memory/projects/mypens-master-roadmap.md` (Phases 5–6)

Do **not** start these builds until the current Engine HTML / stress-test PR stack is merged or explicitly combined. Read the master roadmap sections before coding.

---

## Phase 5 — Engine Report Cockpit (summary)

- Top block name: **The Read**
- Tabs: The Read · Timeline · Body · Training · Composition · Cause · Checks
- Zoomable `from`/`to` on `/period-review` recalculates everything (web app — not offline HTML zoom)
- Graphs: Form score + pillar small-multiples + composition + cause evidence
- RHR ladder: **≥50** likely drinking · **≥55** heavy stack; Anchor binge still outranks when logged
- Offline HTML = snapshot export only

Build order: **5-A → 5-B → 5-C → 5-D → 5-E**

---

## Phase 6 — Adaptive Sports Planner (summary)

Dynamic week plan (not the static Programme template).

**Inputs:** sleep, sport history (which sport + volume), optional food, optional Anchor recovery.  
**Sports:** running · cycling · core · gym (user can switch per slot).  
**Constraint:** long session **Saturday or Sunday only** (user toggle).  
**Goals (user-declared):** e.g. VO₂max → 50 · ~13% BF without muscle loss · marathon · custom.

Build order: **6-A → 6-B → 6-C → 6-D → 6-E → 6-F**

v1 planner is **deterministic** (tested pure functions). Optional Claude prose only after JSON plan exists.

---

## Open decisions (ask Jerome if blocked)

1. Default long day: Saturday or Sunday?  
2. Accept week → write into Programme (2-C) or new `PlannerPlan` table?  
3. Required goal fields for VO₂max / BF% / race date  
