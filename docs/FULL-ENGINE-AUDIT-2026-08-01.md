# MY PENS — Adversarial FULL-ENGINE audit

> **Date:** 2026-08-01 · **Auditor:** Claude (Opus 5), adversarial pass
> **Repo:** `C:\Users\jerom\Desktop\claude\Projects\mypens` · branch `main`, HEAD `c295f80`
> **Working tree is dirty** (~30+ modified files uncommitted). This audit reads the **working tree**,
> not `HEAD`. Where it matters, commit-level evidence is cited explicitly.

## Method & limits

| | |
|---|---|
| Read | Code first. Docs used only as *evidence about claims*, never as evidence about behaviour. |
| Executed | `npx vitest run tests/fuelLabsEnergy.test.ts` — read-only, no DB. **21/21 pass.** |
| **Not** executed | No app run, no Supabase access (the `supabase` MCP is unauthenticated in this session). **No runtime verification against Jerome's real data.** No numbers below are his — every quantity is either a code constant or a clearly-labelled hypothetical. |
| Not changed | Nothing. No implementation was performed. |

**Deliverable-format note:** the brief's `## Deliverable format (strict)` section was truncated — the
spec after that heading did not arrive. This report follows the format the body of the brief demands
(severity-ranked fix list doubling as a ship checklist, plus the mandatory *what prior audit missed*
section). Say the word and I will re-cut it to the real template.

---

## 0. Verdict

**I do not certify any engine as sound.** The known P0 is confirmed, still live, and is **not** the
only double-count. Two further double-count paths and one under-count path exist in the same
session-EAT area, plus a cross-cutting timezone defect that can shift a whole day's ledger.

The single most damning artefact is not the bug — it is this:

```
tests/fuelLabsEnergy.test.ts:106
it('never double-counts: residual floors at 0 when Active < sessions and no steps', ...)
```

…passing green, in a suite that **asserts the double-count as correct behaviour** fourteen lines later
(`:111-120`). The suite is not silent about this defect. It defends it.

---

## 1. Severity-ranked findings = ship checklist

| # | Sev | Engine | Finding | Ship |
|---|-----|--------|---------|------|
| E1 | **P0** | Energy | `fromSteps` ignores `sessionEatKcal` → full-day step kcal **plus** full session EAT | ☐ |
| E2 | **P1** | Energy→Causal | P0 contaminates `food_energy_deficit`, `weight_stall_vs_deficit`, `deriveTargets` | ☐ |
| E3 | **P1** | Energy | HC duplicate-session dedup exists in **one** of three energy paths | ☐ |
| E4 | **P1** | Energy | No dedup Strava `TrainingEntry` ↔ `GarminActivity` (same ride counted twice) | ☐ |
| E5 | **P1** | Energy | `hasGarminCals` dedup is day-level → drops *all* Garmin training rows (under-count) | ☐ |
| E6 | **P1** | Energy | Prior audit's own S1 (`tracked = food>0 OR activity>0`) **never fixed** | ☐ |
| X1 | **P1** | Cross-cut | `today()` is server-local (UTC on Vercel), not Europe/Brussels | ☐ |
| T1 | **P1** | Training load | No dedup at all → `trainingLoad` / `activityCount` double-count across sources | ☐ |
| S1 | **P1** | Sleep | No-HRV nights capped at 60/100, then labelled "Reduced capacity" | ☐ |
| B1 | **P1** | Bloodwork | Panel deltas computed with **no unit-compatibility guard** | ☐ |
| D1 | **P1** | Ingest | HC steps overwrite Garmin steps on the same key — last writer wins | ☐ |
| R1 | P2 | Period review | Headline window only labelled when a regex matches | ☐ |
| R2 | P2 | Period/Signals | "Last N days" is a **row** slice, not a calendar slice | ☐ |
| H1 | P2 | HRV | `hrvReadinessInclusiveRolling` puts the night inside its own baseline | ☐ |
| C1 | P2 | Clubroom | Every non-`default` member scored 0; unbounded full-table scans per member | ☐ |
| F1 | P2 | Food | Micros scaled by a kcal-derived gram guess; `completeness` reports no uncertainty | ☐ |
| W1 | P2 | Weekly | Rolling-7d `cycle` + calendar-week `report` in one payload (labelled in JSON only) | ☐ |
| M1 | P2 | Body comp | `muscleMassKg` stored, imported, exported — never used in any calculation | ☐ |

---

## 2. P0 — the energy double-count

### E1 · P0 · `fromSteps` accepts session EAT and discards it

**File:** `C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyNeat.ts`
**Function:** `fromSteps` (`:31-48`), reached from `estimateNeat` (`:83-91`, `:102-104`)

```ts
function fromSteps(
  steps: number,
  sessionEatKcal: number,          // ← received
  weightKg: number | null | undefined,
  ...
): NeatEstimate {
  const neatKcal = stepsToKcal(steps, weightKg)   // ← sessionEatKcal never used
```

`sessionEatKcal` is returned in the payload (`:45`) but never enters the arithmetic. Downstream,
`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyBalance.ts:369`:

```ts
const estimatedOut = roundKcal(bmr.kcal + eatKcal + neat.neatKcal)
```

So on the `steps_model` path, `estimatedOut` = BMR + **all** session EAT + kcal derived from the
**full-day** step count — and that step count already contains the steps taken *during* those
sessions.

**Overcount = the kcal of the session-derived steps, bounded by `min(eatKcal, stepsToKcal(steps))`.**
It is not capped at a small fraction; on a day whose movement is mostly one long walk, it approaches
the entire session EAT.

**Sport-blind.** Nothing in this path inspects sport. `stepsToKcal` (`:24-29`) sees only a step count.
Any step-generating session — walk, run, trail, hike, treadmill — lands in both terms. Bike and gym
leak less *via their own steps*, but their EAT still stacks on top of whatever incidental day-steps
exist, so the day is still overstated.

**Worst for Jerome specifically:** he walks a lot. The walk is simultaneously the largest contributor
to day steps *and* a logged session with device kcal.

### E1b · the 2026-07-27 refactor routes the *worst* days into the buggy path

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyNeat.ts:82-91`:

```ts
// Active < sessions: incomplete HC Active (common) — prefer steps over a locked 0.
if (steps != null) {
  return fromSteps(steps, sessionEatKcal, input.weightKg, deviceActive,
    `Active ${deviceActive} < sessions ${sessionEatKcal}, residual unused`)
}
```

`deviceActive < sessionEatKcal` is precisely the fingerprint of a **big session day** (or a
truncated HC Active feed). The fallback was added to avoid locking NEAT at 0 — a real problem — but
it sends exactly the highest-EAT days into the one path that double-counts. The residual path
(`:69-81`) is safe: `max(0, deviceActive − sessionEatKcal)` subtracts correctly.

### Attack cases — resolved on paper against the code

| # | Scenario | Predicate hit | Result |
|---|----------|---------------|--------|
| 1 | 12k steps + logged walk, Active missing | `deviceActive == null` → `:102` | **Double-counts** |
| 2 | Same, Garmin Active ≥ sessions | `:72` true | **Correct** — residual protects |
| 3 | Long run + steps, no "walk" label | `:83` or `:102` | **Double-counts** — sport never inspected |
| 4 | Indoor bike + high incidental steps | Active present → residual; else steps | Residual OK; steps path overstates |
| 5 | Same activity Garmin + Strava | see **E4** | **Counted twice in EAT** |
| 6 | Incomplete food + inflated out | `dayIncompleteCapture` (`energyBalance.ts:77-90`) | Flag fires only on **zero** food, not partial → false deficit survives |

Case 6 detail: `dayIncompleteCapture` gates on `!foodCoverage` — *any* single FoodEntry clears it.
A day with breakfast logged and dinner forgotten is "complete", and the inflated `estimatedOut` then
prints a confident deficit.

### E1 · UI — can Jerome see the lie?

**No.** `C:\Users\jerom\Desktop\claude\Projects\mypens\components\food\EnergyBalanceCard.tsx:347-352`
renders `neatDetail` only inside a collapsed **"Legend & method"** accordion, at `text-[11px]` /
`text-ct-second/45`. `neatSource` is read once (`:138`) and only to test for `'none'`. The detail
string itself says *"NEAT from steps (… × ~0.04 kcal @ 70 kg ref) — Active 14 < sessions 177,
residual unused"* — it describes the mechanism and never states that session burn is counted twice.
Mobile is the same shape (`mypens-mobile\app\(tabs)\food.tsx:1291`, `:1688`).

### E1 · Fix sketch

Minimum, matching the brief:

```ts
// lib/energyNeat.ts — inside fromSteps
const gross = stepsToKcal(steps, weightKg)
const neatKcal = Math.max(0, gross - sessionEatKcal)
```

Better, if session step counts are ever available: subtract session steps from day steps *before*
`stepsToKcal`, and leave EAT untouched. **Do not invent METs** to model this — the current 0.04
kcal/step constant is already coarse; layering an unvalidated MET table on top adds error and hides it.

Either way `neatSource`/`neatDetail` must surface on the **default** card, not behind an accordion:
`steps_model` days are estimate-on-estimate and should be visually distinct from residual days.

### E1 · Test that would have caught it

```ts
it('steps model does not re-count session burn', () => {
  const n = estimateNeat({ sessionEatKcal: 400, steps: 12000, weightKg: 80 })
  expect(n.neatKcal).toBeLessThanOrEqual(stepsToKcal(12000, 80) - 400)
})
```

There is no such test. The nearest one asserts the opposite (`tests/fuelLabsEnergy.test.ts:111-120`).

---

## 3. Energy — remaining findings

### E2 · P1 · The P0 propagates into narrative, signals and targets

Three consumers read `energyDelta` / `estimatedOut` and none of them know the value may be inflated:

1. **Causal hypothesis** — `C:\Users\jerom\Desktop\claude\Projects\mypens\scripts\lib\periodCausal.mjs:477-490`
   fires `food_energy_deficit` (confidence up to **0.75**) at `deficitShare ≥ 0.5` and
   `avgDelta ≤ −300`, telling Jerome *"Chronic under-fuelling can mimic overtraining/illness signals."*
2. **Signal** — `C:\Users\jerom\Desktop\claude\Projects\mypens\lib\signals\detectSignals.ts:156-178`
   fires `weight_stall_vs_deficit` when the scale is flat while mean delta ≤ −300. **An inflated
   `estimatedOut` manufactures exactly this pattern**: the ledger says deficit, the body says
   maintenance, and the app concludes something is wrong with *him*.
3. **Targets** — `C:\Users\jerom\Desktop\claude\Projects\mypens\lib\bodyPhase.ts:29-46` derives
   `deriveTargets` from `maintenanceKcal`; if maintenance is sourced from the ledger it inherits the
   inflation and prescribes a real under-eat.

**Who is hurt:** Jerome, in the exact direction the previous audit already warned about — *the ledger
systematically overstates deficit* — now with a second, independent mechanism doing it.

**Ship row (defence in depth, independent of E1):** suppress or down-rank `food_energy_deficit` and
`weight_stall_vs_deficit` on days where `neatSource === 'steps_model'`, and carry `neatSource` into
`WindowDayEnergy` so the causal layer can see it. It currently cannot — `getEnergyBalanceForRange`
(`lib\energyBalance.ts:592-605`) drops `neatSource` from its return shape entirely.

### E3 · P1 · Duplicate-session dedup exists in one energy path out of three

`getDayEnergyBalance` builds `hcWindows` and skips overlapping Health-Connect duplicates by
package-name preference — `C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyBalance.ts:273-313`:

```ts
// Prefer Garmin-sourced HC sessions over overlapping Google Fit duplicates.
const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start)) / 1000
if (shorter <= 0 || overlap < shorter * 0.5) continue
```

That block exists **only** there. Neither `getEnergyBalanceForRange` (`:458-607`) nor
`getRollingEnergyRecap` (`:687-839`) reproduces it — they aggregate `trainingByDate` with no overlap
check at all (`:542-548`, `:770-775`).

**Consequence:** the same calendar day yields a *different* EAT, `estimatedOut` and `delta` depending
on which screen you open — Fueling day card vs cockpit/period-review vs week recap. No reconciliation
warns about it.

**Repro:** one workout present twice in HC (Garmin package + Google Fit package), both with calories.
Day card: counted once. Cockpit + week recap: counted twice.

**Test:** one fixture day, three entry points, assert identical `eatKcal`.

### E4 · P1 · Strava and Garmin duplicates are never deduped

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyBalance.ts:322-323`:

```ts
// Prefer GarminActivity archive calories over live garmin TrainingEntry duplicates
if (t.source === 'garmin' && hasGarminCals) continue
```

The predicate is `t.source === 'garmin'` only. `TrainingEntry.source` is documented as
`manual | strava | garmin | healthkit | healthconnect`
(`C:\Users\jerom\Desktop\claude\Projects\mypens\prisma\schema.prisma:107`), and
`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\integrations\strava\sync.ts:61` writes
`source: 'strava'`. `GarminActivity` is keyed by `fitFileId` (`schema.prisma:279`) and
`TrainingEntry` by `@@unique([source, externalId])` (`:112`) — **there is no shared key**, so nothing
can collide them.

**Repro:** ride recorded on the Garmin head unit → FIT dump creates `GarminActivity` (calories) →
the same ride auto-uploads to Strava → sync creates `TrainingEntry(source:'strava')` with calories.
Both pass the filter at `energyBalance.ts:353-357`. **EAT counts the ride twice.**

**Fix sketch:** time-window + duration overlap matching across *all* session sources (generalise the
`hcWindows` logic in E3 into one shared `dedupeSessions()`), keyed on start/end, not on source
strings. `GarminActivity` has no start timestamp in the schema — that gap must be closed first.

### E5 · P1 · The Garmin dedup is day-level and drops too much

Same line: `hasGarminCals` is computed once per day (`:250`) as *"does **any** Garmin activity today
have calories"*. If it is true, **every** `source === 'garmin'` TrainingEntry that day is skipped —
including sessions the FIT archive never contained.

**Repro:** morning ride in the FIT dump (with kcal) + evening gym session that only reached the app
as a Garmin `TrainingEntry`. The gym session is silently dropped from EAT. Mirror image of E4:
under-count, same root cause (day-level instead of session-level matching).

### E6 · P1 · The prior audit's own top finding was never fixed

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyWeek.ts:128` and `:135`:

```ts
const tracked = rawDays.filter(d => d.foodKcal > 0 || d.activityKcal > 0)
const isTracked = d.foodKcal > 0 || d.activityKcal > 0
```

This is verbatim what `docs/ANALYSIS-FORMULAS-AUDIT.md` §S1 flagged as **CRITICAL** on 2026-07-25.
`activityKcal = eat + neat` and NEAT is produced without any user action, so for a Garmin-synced user
almost every day is "tracked" — including days with no food logged, which then post
`delta = 0 − (BMR + EAT + NEAT)` as a *real* deficit into `weekNetKcal`, `trackedNetKcal` and
`avgDailyNetKcal`. The imputation machinery that exists to handle this is bypassed by the OR.

An audit finding that survives three shipping commits is a process defect, not just a code defect.
**It needs a ship row, not another audit mention.**

---

## 4. Training load / Form engine

### T1 · P1 · No dedup anywhere in the load path

`C:\Users\jerom\Desktop\claude\Projects\mypens\scripts\lib\periodAnalyze.mjs:210-224`:

```ts
const scored = dayTrainingLoad(acts, trains, { restingHr: row.restingHr ?? 50, hrMax })
row.activityCount = acts.length + trains.length
```

`dayTrainingLoad` (`C:\Users\jerom\Desktop\claude\Projects\mypens\scripts\lib\trainingLoad.mjs:174-209`)
loops activities, then loops trainings, and sums both. **No externalId check, no time-overlap check,
no source preference** — not even the coarse `source === 'garmin'` skip the energy path has.

So the duplicate scenarios in E3/E4 hit training load *harder* than energy: a Garmin+Strava ride
inflates `trainingLoad`, `activityMinutes`, `hardLoad` **and** `activityCount`. `activityCount` then
feeds `scoreDay` (`periodAnalyze.mjs:275-279`), which adds `activityCount * 12` to Form — so a
duplicated session directly inflates the Form score, then CTL/ATL via
`buildFitnessSeries` (`lib\engines\trainingMetrics\fitnessFreshness.ts:70-107`), then `topWin`
("N active days in window", `cockpitData.ts:561-564`).

**Two engines, two different dedup policies, on the same rows.** Whatever the right policy is, it must
be *one* shared function.

### Verified sound (with caveats stated in code)

- **Banister CTL/ATL/TSB** — `fitnessFreshness.ts:70-107`. `α = 1 − e^(−1/τ)`, τ 42/7, TSB = CTL − ATL.
  Textbook. Calendar-filled via `fillDailyLoads` (`:25-45`), missing days → 0, correct.
- **ACWR** — `:94-95`, suppressed below `ACWR_MIN_CHRONIC = 5`, and `FITNESS_FRESHNESS_META.honesty`
  (`:117-125`) volunteers the statistical criticism. Honest.
- **Foster** — `loadRatios.ts:13-49`. Sample SD (`n−1`), and the flat-week infinite-monotony case
  returns `null` rather than a fake cap (`:33-36`). Honest.
- **Edwards** — `relativeEffort.ts`, and `RELATIVE_EFFORT_META.vsPlu` (`:85-89`) explicitly states
  when to prefer PLU vs Edwards. Good.

**Residual P2:** `rollingFosterWeeks` (`loadRatios.ts:54-72`) slices by array index and admits it —
*"if dates have gaps, still score the slice loads"* (`:63`). It then labels the result
`{from: slice[0].date, to: slice[last].date}`, which can span far more than 7 days while being
presented as a Foster **week**. `fosterWeekEnding` (`:75-87`) does it correctly with a calendar fill;
the cockpit uses that one (`cockpitData.ts:372-376`), so the exposure is low today.

**Units:** PLU is consistently labelled (`TRAINING_LOAD_META`, `trainingLoad.mjs:211-216`) and I found
no ×100 dumps. `hrMax` now has an override path (`cockpitData.ts:302-305` → `periodAnalyze.mjs:205-208`),
closing the hardcoded-185 gap the roadmap flagged; the **fallback** remains 185 and `restingHr`
falls back to 50.

---

## 5. Period review / The Read

### R1 · P2 · The headline is only labelled when a regex matches

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\engines\cockpitData.ts:99-107`:

```ts
export function formatTheReadHeadline(raw: string | null | undefined): string {
  if (/^Form weeks\s*·/i.test(h)) return h
  if (/Latest stretch is|On a \d+-month view|Inside that window/i.test(h)) return `Form weeks · ${h}`
  return h                                    // ← unlabelled fall-through
}
```

`periods.headline` comes from `analyzePeriods(fullData, …)` (`:497-500`) where `fullData` is the
**unclipped** ledger (`loadFrom = from − 90d` … `to`, `:485-493`) — deliberately a different window
from the chip. The prefix makes that honest *only* for three known phrasings. Any other headline
string prints bare and reads as if it describes the selected window.

**Fix:** prefix unconditionally (or return `{text, windowLabel}` and let the UI render the badge).
Regex-matching your own generated copy is a fragile contract.

### Verified fixed — stale Risk bleed

The brief flagged "very high resting HR / heavy drinking" bleeding across months. **That is fixed and
I verified the gate.** `C:\Users\jerom\Desktop\claude\Projects\mypens\scripts\lib\periodCausal.mjs:361-365`:

```ts
const { full: rhrStats, recent: recentRhr, heavyNow, likelyNow } = rhrDrinkSignalIsCurrent(daily)
if (!anchorStrong && rhrStats.heavyStackDays > 0 && heavyNow) {
```

`heavyNow`/`likelyNow` require the recent tail or the latest band (`:73-86`). Cause and Risk are also
de-duplicated against each other by `pickDistinctTopRisk` (`cockpitData.ts:77-93`), and `causal` runs
on the **window-clipped** `daily` (`:502-506`) while only `periods` uses the wide ledger. Correctly done.

### R2 · P2 · "Recent" is a row slice, not a calendar slice

`periodCausal.mjs:67-70` — `recentRhrDrinkEvidence(daily, 5)` takes `daily.slice(-5)`. `daily` contains
only dates that produced signals. With a gap (no wearable data for a stretch), the "last 5 days" can
span weeks, weakening the very currency guard R1-verified above. Same pattern in
`lib\signals\detectSignals.ts` (`sorted.slice(-cfg.windowDays)`, e.g. `:47`, `:159`).

**Fix:** slice on a calendar window (`rollingWindow(n, asOf)` already exists in
`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\timeWindow.ts:59-69`) and report
`daysWithData / windowDays` alongside.

---

## 6. Sleep / RHR / HRV

### S1 · P1 · A no-HRV night is silently capped at 60/100

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\readinessMetrics.ts:7-14`:

```ts
export function computeSleepScore(hours: number, quality: number | null | undefined): number {
  const hoursScore = Math.min(1, hours / 8) * 60
  if (quality == null || !Number.isFinite(quality)) {
    return Math.round(hoursScore)          // ← max 60
  }
  return Math.round(hoursScore + ((quality - 1) / 4) * 40)
}
```

The intent is right and stated — *"never invent mid-band quality (WP 0.2)"*. The **consequence** is
not handled: a flawless 8-hour night with no HRV scores **60**, and `readinessLabel` (`:23-29`) calls
60 **"Reduced capacity"**. Two nights on the same 0–100 scale are not comparable, and the number that
reaches the user is wrong in a specific, always-pessimistic direction.

**Repro:** `computeSleepScore(8, null)` → `60` → `readinessLabel(60)` → `"Reduced capacity"`.

**Fix:** either renormalise the duration-only branch to its own 0–100 (`hoursScore / 0.6`) and tag the
result `durationOnly: true`, or return `null` and let the UI say "no HRV — duration only". Do not
return a number on the full scale that was computed on a partial scale.

**Test:** `expect(computeSleepScore(8, null)).not.toBeLessThan(computeSleepScore(6, 3))` — currently
`60` vs `75`, i.e. the perfect night scores *below* the mediocre one.

### H1 · P2 · Two HRV baselines, one of them self-referential

`baselineHrvBefore` (`:36-42`) is strictly prior — correct. `hrvReadinessInclusiveRolling` (`:59-67`)
includes the latest night in its own baseline, biasing the ratio toward 100 and damping real drops.
The docstring is honest about it (*"Matches legacy `/api/readiness` behaviour"*), but both are
exported and either can be picked by a caller. Pick one; delete the other.

### Empty-series honesty — verified good

`cockpitData.ts:454-467` pushes explicit `loadNotes` when HRV or stress days are zero, naming the
table and the fix, rather than rendering a confident score over nothing.

---

## 7. Food / nutrition

**Macros are production-complete**; micros are enrichment-only and honestly separated. Verified:

- `enrichmentWritePayload` (`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\foodEnrichment.ts:389-401`)
  writes `microsJson` / `tagsJson` / `enrichmentJson` **only** — macros are never in the payload, and
  `macrosPreserved: true` is recorded in the meta (`:366`).
- `no_match` returns `micros: {}` and `completeness: 0` with a stated `reason`
  (`:322-335`) — no fabricated micros for homemade food. Correct.
- `already_enriched` guards against silent re-writes unless `force` (`:273-286`).
- `FoodEntry` (`prisma\schema.prisma:48-67`) comments the contract: *"macros never stored here"*.

### F1 · P2 · Micros inherit a gram estimate that isn't disclosed downstream

`scoreMacroFit` (`:166-209`) derives `estimatedGrams` from the **kcal ratio** (`:174`), optionally
blended with a parsed portion, then micros are scaled by `estimatedGrams / 100` (`:337-339`).
`completenessScore` (`:217-223`) then reports a clean fraction of 9 known keys — a *coverage* number
that says nothing about the *accuracy* of the scaling. `confidence` and `estimatedGrams` are preserved
in `enrichmentJson` (`:352-367`), so the audit trail exists; it just isn't propagated to whatever
renders "completeness".

**Not a P1** — nothing here pretends to be full nutrition, and macros are untouched.

**Mobile save path:** not fully traced. `app/api/food/route.ts` accepts `micros`/`tags` on both POST
(`:62-63`) and PATCH (`:158-162`) and tolerates missing columns (`:98`), so the API does not force
macro-only. Whether the mobile client *sends* them is **NOT VERIFIED** — see §11.

---

## 8. Bloodwork

### B1 · P1 · Deltas are computed with no unit check

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\bloodworkPanelDelta.ts:66-88`:

```ts
const delta = latestVal != null && prevVal != null
  ? Math.round((latestVal - prevVal) * 100) / 100 : null
...
unit: m.unit ?? prev.unit ?? null,     // ← latest's unit wins, silently
```

Markers are paired on `normalizeMarkerCode` alone. If two panels report the same marker in different
units, the subtraction is meaningless and is then rendered as a confident trend —
`trendChipLabel` (`:115-120`) prints `previous → latest (Δ)` with **one** unit label attached to both
numbers.

**Repro:** panel A cholesterol `200 mg/dL`, panel B `5.2 mmol/L` → `delta = −194.8`, `trend: 'down'`,
displayed as `200 mmol/L → 5.2 mmol/L (−194.8)`. Not hypothetical for this repo: three lab PDFs from
at least two different labs sit in the repo root.

**Fix:** require `normalizeUnit(prev.unit) === normalizeUnit(m.unit)`; otherwise emit
`trend: 'unknown'`, `delta: null` and a `unitMismatch` reason. Convert only where a validated
conversion factor exists.

**Test:** `comparePanelMarkers([{code:'cholesterol', valueNum:5.2, unit:'mmol/L'}], [{code:'cholesterol', valueNum:200, unit:'mg/dL'}])` → expect `delta` null.

### Verified good

`flagRefRange` uses **each panel's own** `refLow`/`refHigh` (`:85-86`) rather than a global range —
correct, and it returns `'unknown'` rather than guessing when refs are missing
(`lib\bloodworkFlags.ts`, exercised at `tests/fuelLabsEnergy.test.ts:158-163`). No "flagged" claim is
made without panel coverage: `loadBloodworkLatestSummary` gates on `present` and the cockpit renders
an explicit *"No blood panel on file"* branch (`cockpitData.ts:522-534`). Labs never rewrite BMR —
`energyBmr.ts:5-7` states it and the code honours it.

---

## 9. Weight / body composition

**Katch–McArdle** (`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\energyBmr.ts:49-52`) is correct:
`FFM = kg × (1 − BF%/100)`, `BMR = 370 + 21.6 × FFM`, preferred over Mifflin when BF% is plausible
(`isPlausibleBodyFatPct`, `:44-46`, bounds 3–60%). BF% is carried on/before the date from `WeightEntry`
(`energyBalance.ts:113-141`). No contradiction with the energy path.

**Calibration** (`lib\energyWeightCalibration.ts`) is honest — `~7700 kcal ≈ 1 kg` with the disclaimer
*"Water, glycogen, and noise dominate short windows — not a model grade"* (`:17-18`), and it returns
`null` rather than a fake reading when there are fewer than two weights (`:28`).
**But** its input `weekNetKcal` carries E1 + E6, so the `residualKcal` "gap" it reports will be
systematically skewed — the calibration will keep telling Jerome the *scale* is off.

### M1 · P2 · `muscleMassKg` is dead weight

Imported (`app/api/import/route.ts:120`), synced (`lib/integrations/garmin/bodyCompSync.ts:61`),
parsed (`lib/tanitaCsv.ts:213-222`), exported (`app/api/export/route.ts:36-37`) — and referenced by
**zero** calculations. That is methodologically fine (Katch needs FFM, not muscle mass), but it is a
field the UI could easily start trusting. Either wire it to a validated use or mark it
reference-only in the schema comment.

---

## 10. Clubroom

### C1 · P2 · The leaderboard ranks one real person against zeros

`C:\Users\jerom\Desktop\claude\Projects\mypens\app\api\clubroom\leaderboard\[clubId]\route.ts:24-27`:

```ts
if (userId !== 'default') {
  return { weeklyScore: 0, currentStreak: 0, medalsEarned: 0 }
}
```

Every member who is not the local instance scores zero, and the rows are then **sorted and rendered
as a ranking** (`:78`). The privacy instinct is right; the output is a table that looks like a
competition and is an artefact of the stub.

**No leakage into personal math** — verified: `weeklyScore = weeklyWeight×2 + weeklyTraining×3`
(`:48`) counts **logged days only**, never energy or training-load values. The comment
*"never raw values"* (`:46`) is accurate.

**Secondary (perf):** `getScoreForUser` issues four **unbounded** `findMany` calls over
`weightEntry` / `trainingEntry` / `sleepEntry` / `foodEntry` (`:31-35`) — full history, no date filter
— and does so **per member**, in `Promise.all`. On a real ledger this is an N×full-table scan per
leaderboard render.

---

## 11. Cross-cutting

### X1 · P1 · `today()` is server-local, not Europe/Brussels

`C:\Users\jerom\Desktop\claude\Projects\mypens\lib\timeWindow.ts:42-45`:

```ts
/** Local "today" — noon-anchored so 00:00–02:00 Brussels still matches the wall clock. */
export function today(now: Date = new Date()): string {
  return toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0))
}
```

`getFullYear()/getMonth()/getDate()` read the **runtime's** timezone. On Vercel that is **UTC**
(`vercel.json` pins `regions: ["dub1"]` but sets no `TZ`, and no `TZ` appears anywhere in the repo).
The noon anchor protects the *arithmetic* in `shiftDateStr`; it does nothing for the initial
derivation. Between 00:00 and 02:00 Brussels (CEST = UTC+2), the server's "today" is **yesterday**.

The codebase already knows this. `C:\Users\jerom\Desktop\claude\Projects\mypens\lib\integrations\healthconnect\mapping.ts:61-64`:

```ts
// Calendar day in Europe/Brussels (not UTC slice — late rides must not roll to previous day).
timeZone: 'Europe/Brussels',
```

So HC ingest files a late-evening session under Brussels-day *X* while a server route computing
`today()` at the same moment may be reading day *X−1*. Blast radius: `getRollingEnergyRecap` default
`asOf` (`energyBalance.ts:698-701`), `rollingWindow` defaults, `calcStreak` in Clubroom
(`leaderboard route :10-13` — a streak can break at midnight-to-02:00), and every cron-triggered window.

**Why the test can't catch it —** `C:\Users\jerom\Desktop\claude\Projects\mypens\tests\timeWindow.test.ts:9-15`:

```ts
const localMidnightish = new Date(2026, 6, 26, 0, 30, 0, 0)
expect(today(localMidnightish)).toBe('2026-07-26')
```

It builds a `Date` from **local** fields and then asserts on **local** fields. That is a tautology: it
passes in every timezone, including the UTC runtime where production is wrong. It reads like a
regression test for exactly this bug and tests nothing.

**Fix:** derive the wall date via `Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Brussels'})`
(the pattern already used in `healthconnect/mapping.ts`), or set `TZ=Europe/Brussels` in the Vercel
env and assert it at boot. **Test:** run `today()` with `process.env.TZ='UTC'` and a fixed instant of
`2026-07-25T22:30:00Z`, expect `'2026-07-26'`.

### D1 · P1 · HC steps overwrite Garmin steps — last writer wins

`C:\Users\jerom\Desktop\claude\Projects\mypens\app\api\integrations\healthconnect\ingest\route.ts:18-32`:

```ts
await prisma.garminDailyMetric.upsert({
  where: { date_kind: { date: m.date, kind: 'steps' } },
  ...
  update: { valueNum: Math.round(m.steps), raw: JSON.stringify({source:'healthconnect', ...}) },
```

The Garmin dump importer writes the **same** `(date, kind='steps')` row. There is no merge, no `max`,
no per-source column — whichever sync ran last defines the day's step count, and therefore NEAT on
every `steps_model` day. `raw` records the winning source, but nothing reconciles or warns.

**Same key collision applies to `active_calories`** (`:38-42`), which decides *which NEAT path runs at
all* (`energyNeat.ts:69`, `:72`). A late HC sync writing a low Active value can flip a day from the
safe residual path to the double-counting steps path.

**Fix:** store per-source rows (add `source` to the unique key) and resolve at read time with an
explicit, tested precedence.

### W1 · P2 · Rolling and calendar week in one payload

`C:\Users\jerom\Desktop\claude\Projects\mypens\app\api\weekly-feedback\route.ts:59` builds `cycle`
from `rollingWindow(7)` (ending **today**), while `report` (`:110-112`) is the stored
`WeeklyFeedbackReport` keyed on `weekOf` = **Monday** calendar week
(`scripts\weekly-feedback.mjs:92-100` via `weekBounds`). Both ship in one response.

The JSON *is* labelled — `cycle.window` carries `{from, to, label:'rolling', days:7}` from
`timeWindow.ts:68`. So the contract is honest at the API boundary. Whether the UI renders that label
next to the numbers is **NOT VERIFIED** (see below). Cron/live consistency is otherwise fine: the
generator and the reader agree on Monday keys.

---

## 12. What the prior Claude audit missed

`docs/ANALYSIS-FORMULAS-AUDIT.md`, dated 2026-07-25, committed in `cec037b`.

### Miss 1 — it certified the day ledger as sound

**The claim** (`:18-22`):

> "**Headline.** The *day* ledger is sound — the anti-double-count architecture (§3 of the doc) is real
> and correctly implemented. The defects are concentrated in the **rollup and reconciliation layer**"

**The evidence it had.** Its own scope table lists `energyNeat.ts` under "Code read" and
`tests/fuelLabsEnergy.test.ts` under "Tests read" (`:12-16`). Both artefacts contained the defect.

**The defect predated the audit.** `git show 10b7f3d:lib/energyNeat.ts` (commit dated 2026-07-25,
the audit's own date) contains:

```ts
if (steps != null) {
  const neatKcal = stepsToKcal(steps, input.weightKg)
  return { neatKcal, source: 'steps_model', steps, deviceActiveKcal: null,
           sessionEatKcal,                       // ← accepted, never subtracted
           detail: `NEAT from steps (…)` }
}
```

Identical shape to today's `fromSteps`. The 2026-07-27 refactor (`a70da1c`, confirmed by
`git blame -L 31,48 lib/energyNeat.ts`) extracted it into a helper and added the
`Active < sessions` fallback — it **widened** the blast radius, it did not create the bug.

**Why it passed.** The file's own header comment at that commit read:

> "Prefer Garmin/device Active residual… Else steps→kcal model. **Never add both (would double-count).**"

The auditor accepted the module's self-description of what "double-count" means. "Never add both"
addresses *residual + steps*. It says nothing about *steps + session EAT*. The audit tested the
architecture against the claim rather than against the arithmetic, and the claim was narrower than the
problem. **A comment asserting a safety property is not evidence of that property.**

### Miss 2 — the test suite asserts the bug, and the audit read the suite

`tests/fuelLabsEnergy.test.ts:111-120`:

```ts
it('falls back to steps when HC Active under-reports vs sessions', () => {
  const n = estimateNeat({ sessionEatKcal: 177, deviceActiveKcal: 14, steps: 12581, weightKg: 70 })
  expect(n.source).toBe('steps_model')
  expect(n.neatKcal).toBe(stepsToKcal(12581, 70))     // ← 177 kcal of EAT ignored, asserted correct
})
```

Fourteen lines above it, `:106`:

```ts
it('never double-counts: residual floors at 0 when Active < sessions and no steps', ...)
```

A test **named** "never double-counts" sits immediately above a test that **pins** the double-count.
I ran the file: **21/21 green.** Green suites were read as evidence of correctness. They were evidence
that the wrong invariant was encoded.

### Miss 3 — §13 tracked the wrong uncertainty

The audit's §13 review (`:298-313`) notes the doc *"is accurate on the day-ledger core (§1 formula,
§3 anti-double-count rules…)"* and marks the steps model as an *"open question"* about the step→kcal
**curve** (0.04 kcal/step, weight scaling). That is *parameter* uncertainty. The defect is a
*structural* one — a term that should not be in the sum at all. The audit's own closing line concedes
the shape of the failure (`:313`): it flagged modelling uncertainty *"while omitting **implementation**
defects."* It then did not apply that lesson to §3.

### Miss 4 — the doc never said it, and still hasn't been committed saying it

`git blame` on `docs/ANALYSIS-FORMULAS.md:66` returns **`00000000 (Not Committed Yet 2026-08-01)`**:

> "Steps→kcal uses **full-day steps** (does **not** subtract walk/run session steps)"

So: the caveat was **absent** on 2026-07-25 (the auditor could not have read it), was added later by
the Cursor energy pass, and **is still sitting uncommitted in the working tree today**. It is also
purely descriptive — it states the behaviour and never names it as a defect. Documenting a bug in
neutral voice is not disclosing it.

### The process lesson

Four independent artefacts — module comment, test names, formulas doc, audit headline — all asserted
"no double-count", and none of them was a *measurement*. The one artefact that would have settled it
in ten seconds (an inequality assertion on `neatKcal` vs `stepsToKcal − sessionEat`) did not exist and
still does not. **Certification must come from an executable assertion, not from prose that agrees
with other prose.**

---

## 13. NOT OPENED — declared

These trees were not read; no claim in this report depends on them.

| Path | Note |
|---|---|
| `lib\investing\`, `app\api\investing\` | Backtest engine — separate domain, out of the health-calculation scope |
| `lib\planner\planWeek.ts`, `app\api\planner\` | Read only via the prior audit's citation, not audited here |
| `lib\retentionModels.ts` | Creatine/alcohol/glycogen retention — **not opened** |
| `lib\verdictData.ts`, `app\api\verdict\` | **Not opened** |
| `lib\anchor\`, `lib\bodyPhaseStore.ts`, `lib\crossAppWriter.ts` | **Not opened** |
| `lib\aiCall.ts`, `lib\*VisionPrompt.ts`, `tests\ai\`, `scripts\run-ai-evals.mjs` | AI/vision extraction — **not opened** |
| `mypens-mobile\` | Grepped for NEAT surfacing only. **Client save/render paths not audited** — this is why F1's "does mobile still save macro-only?" and W1's "does the UI show the rolling label?" are marked NOT VERIFIED |
| `lib\stripe.ts`, `lib\auth.ts`, `lib\rateLimit.ts`, `proxy.ts` | Non-calculation surfaces |
| `lib\bloodworkLongevityHints.ts`, `bloodworkWearableContext.ts`, `bloodworkChart.ts` | **Not opened** |
| `lib\engines\trainingMetrics\gap.ts`, `peakCurves.ts`, `efficiency.ts` | Exports reviewed via `index.ts`; **bodies not audited** |
| Runtime data | **No Supabase access.** Every finding is static-analysis grade with a stated repro. |

---

## 14. Recommended ship order

1. **E1** — the clamp. One line, plus flip `tests/fuelLabsEnergy.test.ts:111-120` to an inequality.
   Nothing else is worth doing while the ledger is wrong.
2. **X1 + D1** — day identity and step provenance. Both silently change which numbers a day *has*;
   fixing E1 on top of a wrong day boundary buys less than it looks.
3. **E3/E4/E5 + T1 together** — one shared `dedupeSessions()` consumed by both the energy and load
   paths. Fixing them separately re-creates the current two-policy split. Requires adding a start
   timestamp to `GarminActivity` first.
4. **E6** — split the `tracked` OR. It is a known-critical finding that has now survived one audit.
5. **S1, B1** — both produce a specific wrong number a user would act on.
6. **E2** — defence in depth: carry `neatSource` into `WindowDayEnergy` and gate the deficit narrative.
7. P2 rows as cleanup.

**Do not mark any row shipped without an executable assertion attached.** That is the actual finding
of this audit.
