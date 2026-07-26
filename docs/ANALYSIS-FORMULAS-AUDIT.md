# MY PENS — Formula Audit

> Audit of `docs/ANALYSIS-FORMULAS.md` **against the implementing code**, 2026-07-25.
> Every finding cites `file:line`. Numbers below are either code constants or clearly-labelled
> worked examples with stated assumptions — no measured user data is asserted.

---

## 0. Scope & method

| | |
|---|---|
| Artifact under audit | `docs/ANALYSIS-FORMULAS.md` (378 lines, 14 sections) |
| Code read | `lib/energyBalance.ts`, `energyBmr.ts`, `energyNeat.ts`, `energyWeek.ts`, `energyWeightCalibration.ts`, `energyKcalExtract.ts`, `readinessMetrics.ts`, `foodMicros.ts`, `retentionModels.ts`, `lib/integrations/garmin/sleepSync.ts`, `lib/planner/planWeek.ts` |
| Tests read | `tests/fuelLabsEnergy.test.ts`, `tests/weekEnergyThyroid.test.ts` |
| Not executed | No runtime/DB access. Findings are static-analysis grade; each has a stated reproduction. |

**Headline.** The *day* ledger is sound — the anti-double-count architecture (§3 of the doc) is real
and correctly implemented. The defects are concentrated in the **rollup and reconciliation layer**:
what counts as a tracked day, what the scale is compared against, and which calories never enter the
ledger at all. Three findings (S1–S3) can each move the weekly net by thousands of kcal, and they
compound in the same direction — **the ledger systematically overstates deficit.**

Severity key: **S1–S3 critical** (materially wrong output) · **S4–S8 major** (wrong or unattributable
under common conditions) · **S9–S15 minor** (drift, hygiene, edge cases).

---

## 1. Formula integrity — findings

### S1 · CRITICAL — A day with zero food logged counts as "tracked"

`lib/energyWeek.ts:135` · `:142`

```ts
const tracked = rawDays.filter(d => d.foodKcal > 0 || d.activityKcal > 0)
const isTracked = d.foodKcal > 0 || d.activityKcal > 0
```

`activityKcal = eat + neat` (`energyBalance.ts:518`), and NEAT is produced from device steps or
Active calories **without any user action** (`energyNeat.ts:48-70`). For a Garmin-synced user,
`activityKcal > 0` on essentially every day. So the OR makes almost every day "tracked" — including
days where nothing was eaten *into the app*. Those days keep `foodKcal = 0` and post
`delta = 0 − (BMR + EAT + NEAT)`.

**Worked example** (illustrative, 80 kg placeholder): stub BMR `22 × 80 = 1,760`, 9,000 steps →
NEAT `round(9000 × 0.04 × 80/70) = 411`, no session. Delta for that day = **−2,171 kcal**, recorded
as a real tracked deficit. Ten such days inside a 30-day window inject ≈ **−21,700 kcal ≈ −2.8 kg**
of phantom deficit into `weekNetKcal`.

Contaminates: `weekNetKcal`, `trackedNetKcal`, `avgDailyNetKcal`, `daysImputed` (reports ~0 when
food coverage is actually poor), and everything downstream — including S2.

The imputation machinery exists precisely to handle this and is bypassed by the OR.

**Fix.** Split the flag; impute each channel on its own evidence:

```ts
const foodTracked     = d.foodKcal > 0
const activityTracked = d.activityKcal > 0 || d.deviceDayPresent
// impute food from mean of foodTracked days; activity from activityTracked days
```

Expose `foodDaysLogged` / `windowDays` on the summary so the UI can say *"7 of 30 days logged"*
rather than implying full capture.

**Why the tests missed it** — `tests/weekEnergyThyroid.test.ts:47-48` only exercises the
fully-empty day (`foodKcal: 0, activityKcal: 0`). The realistic partial day
(`foodKcal: 0, activityKcal: 411`) is untested.

---

### S2 · CRITICAL — Weight calibration compares an N-day ledger to an arbitrary weigh-in span

`lib/energyWeightCalibration.ts:29-35` · `lib/energyBalance.ts:529-537`

```ts
const start = sorted[0]; const end = sorted[sorted.length - 1]
const predictedKg = Math.round((weekNetKcal / KCAL_PER_KG) * 100) / 100
const observedKg  = Math.round((end.scaleKg - start.scaleKg) * 100) / 100
```

`predictedKg` is derived from the **whole window's** net kcal. `observedKg` is derived from the
earliest and latest weigh-in *that happen to exist*, with **no check that they span the window**.
Two weigh-ins three days apart inside a 30-day window are compared against 30 days of ledger.

The caller widens the failure: when fewer than two weigh-ins fall inside the window, `calibPool`
falls back to the `±1 day` pool (`energyBalance.ts:532-535`) — still no span normalisation.

Two further compounding issues:
- The input is `recap.summary.weekNetKcal`, which **includes imputed days** — imputed estimates are
  reconciled against a real scale movement as if they were measured.
- The residual then drives user-facing copy ("ledger may overstate deficit by ~N kcal",
  `energyWeightCalibration.ts:45`) — a wrong number wearing a confident sentence.

**Fix.**

```ts
const spanDays = daysBetween(start.date, end.date)          // ≥ 1
if (spanDays < Math.ceil(0.6 * windowDays)) return { ...null-ish, reason: 'span_too_short' }
const ledgerOverSpan = netKcalBetween(start.date, end.date) // prorate, don't reuse window total
```

Return `spanDays`, `windowDays`, and `imputedDaysInSpan` on the object so the card can degrade
honestly instead of silently.

**Why the tests missed it** — `tests/weekEnergyThyroid.test.ts:66-69` uses weigh-ins on 07-19 and
07-25, exactly spanning a 7-day window. The mismatch case is never constructed.

---

### S3 · CRITICAL — Alcohol calories never reach the ledger, and two constants disagree

Two different alcohol-kcal constants live in the same codebase:

| Location | Constant | Implies |
|---|---|---|
| `lib/retentionModels.ts:41` | `units × 56` | UK unit, 8 g ethanol |
| `app/verdict/dossier/page.tsx:106` | `units × 70` | 10 g ethanol (BE/NL standard) |

25% apart, for the same input field. The doc (§8) records only `units·56`.

Worse: **neither reaches the energy ledger.** `getDayEnergyBalance` sums only `FoodEntry.kcal`
(`energyBalance.ts:142-145`), while `alcoholUnits` is a column on `WeightEntry`
(`app/api/weight/route.ts:48`). Alcohol logged as units is invisible to `foodKcal`, so `delta`
understates intake on exactly the days where intake is least reliably logged — and it stacks with S1
in the same direction.

**Fix.** One exported constant (`KCAL_PER_ALCOHOL_UNIT`, set to the unit definition actually used at
entry time — declare 8 g or 10 g explicitly in the doc), and a ledger path: either auto-create a
`FoodEntry` on alcohol log, or add an `alcoholKcal` term to `foodKcal` with its own
`origin: 'alcohol'` source row so it stays visible and auditable in the sources list.

---

### S4 · MAJOR — Sleep quality silently defaults to 3 when HRV is absent

`lib/integrations/garmin/sleepSync.ts:18-19`

```ts
function hrvToQuality(hrv?: number): number {
  if (!hrv) return 3
```

A missing (or zero) HRV yields exactly the mid-scale value, which then carries **40% of the sleep
score** (`readinessMetrics.ts:3-7`: `((quality − 1) / 4) × 40`). Downstream, a defaulted 3 and a
measured 3 are indistinguishable — there is no provenance field on `SleepEntry`. The doc (§7)
documents the four HRV thresholds and omits the default entirely.

This is a fabricated neutral value entering a published score. It also biases the score toward the
middle exactly on nights where the wearable was not worn — which correlate with disrupted nights.

**Fix.** Add `qualitySource: 'manual' | 'hrv' | 'default'`; when `default`, return the duration
component only and label the score partial rather than blending in a made-up 40%.

---

### S5 · MAJOR — Two incompatible HRV baselines, one of them self-referential

`lib/readinessMetrics.ts:29` (strictly prior) vs `:52` (inclusive of tonight).

- `/api/readiness` uses the **inclusive** variant (`app/api/readiness/route.ts:46`).
- `lib/crossAppWriter.ts` uses **either**, depending on branch (`:66` inclusive, `:68` strict).

So the same night can carry two different readiness numbers depending on which surface renders it.
The doc (§7) describes only one.

The inclusive variant includes tonight's HRV in its own baseline, shrinking the ratio toward 100 —
at the minimum sample size of 3 that is a ⅓ self-weight, which systematically mutes exactly the
extreme nights the metric exists to catch. `computeHrvReadiness` also caps at 100
(`readinessMetrics.ts:13`), so supercompensation above baseline is unobservable.

**Fix.** One definition (strictly prior), and report an uncapped standardised value (see §3.9).

---

### S6 · MAJOR — No signal when session kcal exceed device Active

`lib/energyNeat.ts:49` — `const residual = Math.max(0, deviceActive - sessionEatKcal)`

The clamp is correct for the sum (it prevents negative NEAT) but it **discards the diagnostic**.
`sessionEatKcal > deviceActive` is precisely the fingerprint of either a double-counted session or a
session the device never saw. Today it silently becomes `NEAT = 0` and no flag reaches the UI.

**Fix.** Return `residualShortfallKcal = Math.max(0, sessionEatKcal − deviceActive)` and surface it
above a threshold (e.g. >150 kcal) as an attribution warning.

---

### S7 · MAJOR — Non-Garmin sessions are subtracted from Garmin's Active total

`lib/energyBalance.ts:243-255`

`eatKcal` aggregates Garmin FIT activities, TrainingEntries, **and unpromoted `PushedWorkout` rows
from Health Connect / HealthKit / Strava** (`:224-241`). That total is then passed as
`sessionEatKcal` and subtracted from Garmin's `active_calories`.

Garmin's Active total cannot contain a workout Garmin never recorded. Subtracting a foreign session
from it under-counts NEAT by the foreign session's size — the mirror image of the double-count the
architecture is designed to prevent.

**Fix.** Subtract only device-attributable session kcal:

```ts
const deviceSessionKcal = sources.filter(s => s.origin === 'garmin_activity'
  || (s.origin === 'training' && s.detail === 'garmin')).reduce(...)
const residual = Math.max(0, deviceActive - deviceSessionKcal)
// foreign sessions stay additive, flagged `outsideDeviceActive: true`
```

---

### S8 · MAJOR — Day and week disagree on `PushedWorkout` dedup scope

| Path | Set built from | Line |
|---|---|---|
| Day | `externalId` of training rows **on that date** | `energyBalance.ts:184-186` |
| Week | `externalId` of training rows **across the whole window** | `energyBalance.ts:474-476` |

A pushed workout on 07-20 whose `externalId` matches a training row on 07-23 is counted on the day
card and dropped from the week roll-up. Day totals will not sum to the week total. Not documented.

**Fix.** Date-scope both (key the set on `date|externalId`).

---

### S9 · MINOR — `sessionCount` double-counts deduped Garmin rows

`lib/energyBalance.ts:249` adds `training.length + garminActs.length` even though `:213` skips
garmin training rows whose kcal already came from the FIT archive. Also, the day path calls
`extractKcalFromTraining` *before* the dedup check (`:207` vs `:213`), so a kcal-less garmin training
row on a FIT day still increments `sessionsMissingKcal` (`:210`). Both only affect the
`incompleteCapture` flag (`:281-283`), not kcal — but they make it fire on healthy days.

---

### S10 · MINOR — Nutrient flags are coverage-blind

`lib/foodMicros.ts:148` — `if (input.fiberG < 25)` fires at `fiberG = 0`, i.e. on a day with nothing
logged, producing *"Fiber logged 0g — many adults aim near ~25g/day"*. Same shape for the protein cue
(`:155`). Conversely `sodium_high` (`:163`) can only fire when a `sodiumMg` micro exists, which is
sparse — so it has near-zero recall and never reports "unknown".

Same root cause as S1: **absence of data is being read as a measurement of zero.**

**Fix.** Gate on `entriesLogged > 0`, and add a `data_sparse` tone for "not enough logged to judge".

---

### S11 · MINOR — Retention math is duplicated inside a page component

`app/verdict/dossier/page.tsx` re-implements model logic that belongs in `lib/retentionModels.ts`:
alcohol kcal (`:106`), retention peak `units × 0.25` (`:111`), and `Math.min(20, units × 3)` (`:127`)
— the last has no counterpart in the model module and is absent from the formula doc. The 56-vs-70
split (S3) is this drift already realised.

---

### S12 · MINOR — Hardcoded alcohol timing drives the decay curve

`app/api/dashboard/route.ts:298` — `hoursSinceAlcohol: latestWeight.alcoholUnits > 0 ? 12 : 999`

The 48-hour decay (`retentionModels.ts:43`) is therefore always evaluated at factor 0.75 on any
drinking day, regardless of actual timing. Defensible as a default; undocumented as an assumption.

---

### S13 · MINOR — Notes kcal regex

`lib/energyKcalExtract.ts:4` — `/(\d+(?:\.\d+)?)\s*kcal\b/i`

Fails on thousands separators (`"1,840 kcal"` → parses `840`), and takes the **first** match, so a
note containing a target before an actual ("goal 800 kcal · burned 1840 kcal") takes the wrong one.
Low frequency, silent when wrong. Add `[\d,]` handling and prefer the largest match.

---

### S14 · MINOR — Inconsistent time semantics inside `retentionModels`

Alcohol decays over 48 h (`:43`); glycogen (`:49-52`) is a pure same-day snapshot with no
carry-over, though glycogen water is the slower of the two in practice. Also `excessCarbs × 0.5 × 3.5`
takes the top of the conventional 3–4 g water per g glycogen range — worth stating as a chosen upper
bound rather than a fact.

---

### S15 · MINOR — Unguarded sort-order contracts

`baselineHrvBefore(priorDescending, …)` (`readinessMetrics.ts:29`) and
`calculateRollingBaseline(history)` (`retentionModels.ts:221-223`, `history.slice(-7)`) both depend on
caller-supplied ordering with no assertion. A caller passing ascending data silently averages the
oldest 14 nights. Cheap to harden with an internal sort.

---

## 2. Doc-vs-code fidelity

The doc is accurate on the day-ledger core (§1 formula, §3 anti-double-count rules, §5 metric kinds
all verified). Gaps found:

| Doc | Says | Code |
|---|---|---|
| §7 sleep quality | Four HRV thresholds | Omits `!hrv → 3` default (`sleepSync.ts:19`) |
| §7 HRV baseline | One definition | Two, used on different surfaces (S5) |
| §2 calibration | "±1 day pool", "soft note only" | Doesn't state it runs on **imputed-inclusive** net, nor that the span is unnormalised (S2) |
| §1 EAT dedup | Ordered priority list | Day path extracts *before* dedup; week path after (S9) |
| §1 / §2 pushed dedup | One rule | Two scopes (S8) |
| §8 alcohol | `kcal = units·56` | Also `×70` elsewhere (S3); neither enters the ledger |
| §6 macro targets | Restates `2000 / 150 / 200 / 70` inline | Lives in `lib/foodModels.DEFAULT_TARGETS` — point at the constant, restated numbers drift |
| §13.2 steps model | Listed as open question | Correct — but §13 doesn't list S1/S2/S3, the three that actually move the number |

**Recommendation:** the doc's §13 "known gaps" list is well-written but skews toward *scientific*
uncertainty (steps curves, 7700 kcal/kg) while omitting *implementation* defects. An external
reviewer reading §13 would conclude the engineering is settled and only the physiology is open. Add a
"§13b Known implementation defects" block so the honesty rule at the top of the doc holds for both.

---

## 3. Expansion potential & proposed metrics

Ordered by value ÷ effort. Items 1–3 use data **already loaded** in the current queries.
Fixes to the *existing* stack are below; for new measurement surfaces built on stored-but-unused
schema fields, see **`docs/METRICS-EXPANSION.md`** (which also carries finding **S16**, a sleep-units
defect found while mapping the schema).

**1. `restingDelta` — free reconciliation.** `deviceRef.restingKcal` is already fetched
(`energyBalance.ts:118`) and never used. `bmrKcal − deviceRestingKcal` explains, by construction,
the *entire* gap between MY PENS `estimatedOut` and Garmin Total on residual-NEAT days. It turns the
side-by-side comparison (doc §1, Phase C) from "two numbers differ" into "they differ by exactly this
much, for this reason." Zero new data, one subtraction.

**2. A `coverage` object on every rollup.** `foodDaysLogged/N`, `deviceDaysPresent/N`,
`sessionsWithKcal/sessionsTotal`, `imputedDays/N` → one `confidence: 'high'|'medium'|'low'`. Gate
calibration, the week card headline, and the nutrient flags on it. This is the structural fix for
S1/S2/S10 as a class rather than one at a time.

**3. EWMA weight trend instead of endpoint deltas.** `observedKg = end − start` (S2) is maximally
noise-exposed — it uses exactly two measurements and throws the rest away. An α ≈ 0.1 exponential
trend over the window strips most water noise and makes the 7700 kcal/kg check meaningful at 14–28
days, which the doc already concedes it is not at 7 (§13.8).

**4. Adaptive TDEE (opt-in) — the highest-value addition.** Once 3–4 items above land, regress
EWMA weight trend on cumulative net kcal over ≥28 days to recover a *personal* `kcalPerKg` and a
`tdeeBias` multiplier on `estimatedOut`. This is what turns a device-echo ledger into a calibrated
one. Guardrails, matching the doc's honesty rule and §14: opt-in, never a silent rewrite, always
shown as "your data suggests the estimate runs N% high", requires `confidence: high` and ≥28 days.

**5. MET-table session fallback** (doc §14) with `estimateGrade: 'device' | 'met_table' | 'none'`
per source row, so `incompleteCapture` becomes a graded quality signal instead of a boolean.

**6. Body-mass-relative nutrition targets.** Flat 150 g protein / 25 g fiber ignore the weight
already in scope. `proteinTargetG = 1.6 × kg` and `fiberPer1000kcal ≥ 14` are the conventional
formulations and cost nothing — the weight is already loaded per day.

**7. Alcohol as a first-class ledger + confounder flag** (S3), plus a `drinkingDay` marker on the
week card. It is simultaneously an intake term, a weight-retention term, and a sleep-quality
confounder; right now it participates in none of the three consistently.

**8. Two-sided sleep duration + `sleepDebt7d`.** `Math.min(1, hours/8)` (`readinessMetrics.ts:4`)
means 11 h scores identically to 8 h. A band (full credit ~7–9 h, tapering both directions) plus a
rolling `Σ(target − hours)` debt term adds the dimension a single night's score cannot carry.

**9. Standardised HRV.** Convention in the literature is ln(rMSSD) with a 7-day vs 28-day baseline
ratio, reported as a z-score against the baseline's own CV. Removes the 100-cap information loss
(S5), removes the n=3 self-reference, and yields a defensible "outside normal variation" band instead
of a bare percentage.

**10. Timezone hardening.** `getEnergyBalanceRange` (`energyBalance.ts:307-311`) builds dates via
`new Date(\`${from}T12:00:00\`)` + `toISOString()`. The noon anchor holds for CET/CEST but breaks at
|offset| ≥ 12. Storing `dateLocal` + `tzOffsetMin` at write time closes doc §13.12 properly.

---

## 4. Contextual fit

- **Single user, device-dense, food-sparse.** This asymmetry *is* the root cause of S1, S2 and S10:
  device channels are always populated, the food channel is intermittent, and the formulas treat both
  as equally present. Every rollup should carry coverage; that one change addresses the dominant
  failure mode of this specific app rather than a generic one.
- **Bike-heavy training.** Long endurance sessions are exactly where `sessionEatKcal` can approach or
  exceed daily Active, making S6 (clamped shortfall) and S7 (foreign-session subtraction) fire on the
  highest-signal days of the year, not the noise days.
- **Alcohol is a tracked variable in this app.** It currently sits in three places with two constants
  and no path into the ledger (S3, S11). Consolidating it is both an integrity fix and the
  prerequisite for any honest drinking-vs-sleep or drinking-vs-weight readout.
- **Engagement design.** Flags that fire on empty data (S10) and confident copy computed from
  unvalidated spans (S2) are the two fastest ways to teach a user to ignore the app. Coverage-gating
  is a trust feature as much as a correctness one.
- **Honesty rule.** The doc opens with *"Device estimates — not metabolic TDEE. Never invent medical
  claims."* S4 (fabricated neutral quality) and S10 (zero read as measurement) are violations of that
  rule inside the code, not the copy.

---

## 5. Prioritised plan

The pure-function layer (`energyWeek`, `energyNeat`, `energyBmr`, `energyWeightCalibration`) is
already cleanly separated from Prisma — **every fix below is unit-testable without a database.**

**Sprint 1 — integrity (highest value, all in pure functions)**
1. S1 split `tracked` into food/activity + expose coverage — `energyWeek.ts`
2. S2 span-normalise calibration, return `spanDays` / refuse short spans — `energyWeightCalibration.ts`
3. S3 single alcohol constant + ledger path
4. S4 `qualitySource` provenance
5. Tests for the four cases the current suite skips: partial-food day, calibration span mismatch,
   `EAT > deviceActive`, cross-date pushed dedup

**Sprint 2 — attribution**
6. S6 shortfall signal · S7 device-only residual · S8 date-scoped dedup · S9 session counting
7. `restingDelta` on the day card
8. `coverage` + `confidence` on all rollups; gate calibration and nutrient flags on it

**Sprint 3 — expansion**
9. EWMA trend → adaptive TDEE (opt-in, gated on `confidence: high` + ≥28 d)
10. MET fallback table · two-sided sleep band + `sleepDebt7d` · standardised HRV
11. `dateLocal` + `tzOffsetMin`

**Doc maintenance (do alongside):** add §13b implementation defects; replace restated constants with
pointers to their modules; document the HRV-missing default, the two baselines, and the calibration's
imputed-inclusive input.

---

## 6. Test coverage gaps

| Untested behaviour | Would have caught |
|---|---|
| Partial day: `foodKcal: 0, activityKcal > 0` | **S1** |
| Calibration where weigh-in span ≪ window | **S2** |
| `sessionEatKcal > deviceActive` | **S6** |
| Pushed workout matching training on a *different* date | **S8** |
| `hrvToQuality(undefined)` | **S4** |
| `baselineHrvBefore` vs `hrvReadinessInclusiveRolling` on the same input | **S5** |
| `extractKcalFromNotes('1,840 kcal')` | **S13** |
| `softNutrientFlags` with zero entries logged | **S10** |

Existing tests are well-formed but exercise only the happy path of each function; the two energy
rollup tests (`weekEnergyThyroid.test.ts:39`, `:63`) both construct inputs that avoid the failure
modes above.

---

*Audit is static-analysis grade — no runtime or DB verification performed. Each finding states its
reproduction so it can be confirmed against live data before any fix ships.*
