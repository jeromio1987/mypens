# MY PENS — Metrics Expansion

> Companion to `docs/ANALYSIS-FORMULAS-AUDIT.md`. What else this app could measure.
> Every proposal names the **schema field or module it builds on** and its **cost**:
> 🟢 free (data already stored) · 🟡 small (new derivation + UI) · 🔵 new input required.
> Descriptive metrics only — no diagnoses, no population percentiles, no medical claims.

---

## 0. Where the untapped data actually is

Mapping `prisma/schema.prisma` (35 models) against `ANALYSIS-FORMULAS.md` (which documents 14
sections, almost all energy) produced one clear result:

**The app stores far more than it computes.** Three categories:

| Stored & rendered, but no derived metric anywhere | Schema |
|---|---|
| `bedtime` / `wakeTime` — sleep **timing** | `SleepEntry:70-71` |
| `bodyFatPct`, `muscleMassKg`, `bodyWaterPct`, `visceralFat` | `WeightEntry:15-18` |
| `waistCm`, `neckCm` + 6 more circumferences | `BodyMeasurement:305-322` |
| `CravingEvent` — a timestamped behavioural event stream | `:568-583` |
| `DayEntry.mode` — self-declared daily intent | `:345-354` |
| `rpe` — subjective session intensity | `TrainingEntry:86` |
| `EventTag` — travel / illness / holiday windows | `:323-333` |
| `mood` (two separate fields) | `JournalEntry:371`, `RecoveryEntry:559` |

| Ingested but never referenced in code | Schema |
|---|---|
| `spo2`, `respiration` — declared `GarminDailyMetric` kinds, **zero** code hits | `:288-290` |

| Computed, but siloed outside the formula book | Where |
|---|---|
| Training load (PLU) with RPE + HR intensity | `scripts/lib/trainingLoad.mjs` |
| `stress`, `body_battery`, `resting_hr` | `scripts/lib/periodAnalyze.mjs`, `garminAnalyze.mjs` |

The live `lib/` engine layer sees **steps and calories**. Everything else lives in the offline
scripts path or in CRUD routes. That split is the biggest structural opportunity here — not new
sensors, but connecting what is already on disk.

---

## S16 · New integrity finding — `SleepEntry.hours` holds two different quantities

Found while mapping the schema; belongs with the audit's numbered findings.

| Write path | `hours` means |
|---|---|
| Manual (`app/api/sleep/route.ts:31`) | `calcHours(bedtime, wakeTime)` = **time in bed** |
| Garmin (`lib/integrations/garmin/sleepSync.ts:105`) | `sleepingSeconds / 3600` = **actual sleep** |

`computeSleepScore(hours, quality)` (`lib/readinessMetrics.ts:3`) treats them as the same number.
Time in bed exceeds actual sleep by roughly 5–15% for most people, so **manual nights score
systematically higher than device nights** for identical sleep — and manual entry always wins
(`sleepSync.ts`, doc §7), so the inflated variant is the one that persists.

**Fix (and the opportunity):** store both — `timeInBedH` and `sleepH`. When both exist for a date,
you get **sleep efficiency = sleepH / timeInBedH** for free, which is the single most useful sleep
metric the app doesn't have. Add `hoursSource` provenance alongside the `qualitySource` field
proposed in audit S4.

---

## 1. 🟢 Free — sleep timing (biggest untapped surface)

`bedtime` and `wakeTime` are stored as `HH:MM` on every manual night and used only for display.
Duration is a weak signal compared to **timing and regularity**, and none of it is computed.

| Metric | Formula | Why it earns its place |
|---|---|---|
| **Midsleep point** | `bedtime + hours/2`, minutes past midnight | The circadian anchor. One number that says *when* you sleep, not how long |
| **Sleep regularity** | SD of midsleep over rolling 7 / 14 d | Irregularity is often the stronger signal; a 30-min SD and a 2-hour SD are different lives |
| **Social jetlag** | \|midsleep(weekend) − midsleep(weekday)\| | Weekday/weekend split is free from the date |
| **Sleep window adherence** | % nights where bedtime falls inside a user-set window | The one number a structured sleep programme actually tracks. Descriptive adherence — not treatment |
| **Sleep efficiency** | `sleepH / timeInBedH` (needs S16 split) | Distinguishes "8h in bed, poor night" from "8h asleep" |
| **Wake-after-target** | `wakeTime` vs `bedtime + targetH` | Flags short-and-early nights as a distinct pattern from short-and-late ones. Descriptive only |
| **Latency proxy** | last `FoodEntry.createdAt` → `bedtime` | Late-eating vs sleep quality, free from existing timestamps |

**Why this cluster first:** it is 100% free, it is the domain where the app currently has the least
analytical depth, and duration alone (`min(1, hours/8)`, audit S8) is the crudest formula in the
codebase.

---

## 2. 🟢 Free — body composition into the energy engine

`WeightEntry` carries full Tanita output; the ledger reads `scaleKg` and nothing else.

**a. Katch–McArdle BMR** — **shipped** in `estimateBmrDetailed` (`lib/energyBmr.ts`):

```
FFM  = scaleKg × (1 − bodyFatPct/100)
BMR  = 370 + 21.6 × FFM
```

Strictly better than Mifflin when body fat % is measured, because it adapts as composition changes —
and it needs no height, birth year or sex, which the audit notes are still unset (doc §13.1). Slot it
**above** Mifflin in the priority chain with `bmrMethod: 'katch_mcardle'`, falling back exactly as
today. This is the single highest-value change to the energy stack that requires no new data.

**b. Fat-mass vs FFM decomposition** 🟢 — Δfat mass and Δfat-free mass over the window, separately.
A cut's actual goal is "fat down, FFM held"; today the app can only see total kilograms.

**c. p-ratio** 🟡 — `ΔFFM / Δtotal mass`. Combined with the calibration residual (audit S2), it
separates three stories the scale conflates: water, fat, and lean tissue.

**d. Measured water vs modelled water** 🟢 — `retentionModels.ts` estimates water retention from
**proxies** (sodium flags, carb load, alcohol) while `bodyWaterPct` **measures** it. Regressing the
model against the measurement is a free validation of a module that currently has no ground truth at
all — and it directly tests the glycogen 3.5 g/g assumption flagged in audit S14.

---

## 3. 🟢 Free — shape, not just mass

| Metric | Source | Note |
|---|---|---|
| **Waist-to-height ratio** | `waistCm` + `UserSettings.heightCm` | Conventional cue ≈ 0.5; more informative than BMI, and height is already a field |
| **Recomposition detector** | waist trend vs weight trend | Weight flat + waist down is a win the scale hides entirely — and the most common reason people quit |
| **Circumference asymmetry** | left vs right arm / thigh | Already stored per side and never compared |

---

## 4. 🟡 Training load — connect the engine that already exists

`scripts/lib/trainingLoad.mjs` computes intensity-weighted load (PLU) from sport class, HR intensity
and **RPE** (`:152-156`). It is absent from the formula book and from `lib/`.

| Metric | Formula | Status |
|---|---|---|
| **ACWR** | EWMA 7 d load ÷ EWMA 28 d load | Not present anywhere. Standard load-management ratio — report it descriptively, and state its known statistical criticisms rather than overselling it |
| **Monotony / strain** (Foster) | `monotony = mean(dailyLoad)/SD(dailyLoad)`; `strain = weeklyLoad × monotony` | Catches "same session every time", which duration and load totals both miss |
| **RPE vs device divergence** 🟢 | `rpe` vs `hrIntensityFactor(avgHr)` — both already stored | **The creative one.** Systematic divergence between how hard it felt and how hard it measured is a genuine under-recovery signal, and nothing in the app compares them |
| **Efficiency drift** 🟢 | kcal or HR per km at matched sport | `GarminActivity` already stores `distanceM`, `durationSec`, `calories` — a fitness trend from stored data |

---

## 5. 🟢 Free — the craving stream is a dataset, not a log

`CravingEvent` (`:568-583`) stores `createdAt`, `target`, `trigger`, `action`, `outcome` per tap.
Nothing aggregates it. This is the richest behavioural data in the app.

**a. Action efficacy** — resisted-rate grouped by `action` (cold_shower / walk / training / gaming /
breath). This is an observational experiment already running, unanalysed. Report as rates **with n
and an explicit caveat** that action choice is confounded by craving severity — but even a crude
ranking beats no ranking, and it is a `groupBy`.

**b. Hazard map** — craving rate by hour-of-day × weekday. Answers "when am I actually exposed"
rather than "how many this week".

**c. Time-to-next-craving** — median hours from an event to the next one, split by action. Does the
chosen action buy time?

**d. Trigger clustering** — `trigger` is free text; a simple keyword pass gives recurring contexts
without any AI dependency.

**e. Craving load vs physiology** 🟡 — count vs prior-night sleep regularity, `body_battery`,
training load, days-since-drink. Present as **descriptive associations with n and coverage stated**,
never as prediction.

**f. Exposure-risk chip** 🔵 — a *pre*-emptive composite (short sleep + low body battery + a
historically high-rate hour) shown before the window rather than after the log. Frame as
"conditions resemble your higher-rate periods" — a descriptive flag, never a probability of relapse.

---

## 6. 🟢 Free — intention vs execution

`DayEntry.mode` (`locked_in | balanced | off`) is a **self-declared intent** captured before the day
happens. Nothing ever compares it to what actually happened.

- **Mode adherence** — on `locked_in` days: drinks logged, sessions completed, food coverage,
  bedtime vs window. One number per mode.
- **Mode calibration** — do the three modes actually produce different outcomes? If `locked_in` and
  `balanced` are statistically indistinguishable, the control is decorative and should be told so.

This is the most interesting behavioural metric available and needs zero new input — the declaration
and the measurement are both already in the database.

---

## 7. 🟢 Free — logging behaviour as a first-class metric

The audit's coverage recommendation (§3.2) generalises further:

| Metric | Source | Use |
|---|---|---|
| **Logging latency** | `FoodEntry.createdAt` − `date` | Same-day logs are more accurate than reconstructions; latency should weight confidence |
| **Entry-time histogram** | `createdAt` hour | Shows when logging actually happens — where a prompt would land |
| **Weekday/weekend coverage split** | `date` | Coverage is almost never uniform, and it biases every weekly average silently |
| **Preset leverage** | `Preset.usedCount` | Which quick-entries carry the load; what's missing |
| **Streak of *complete* days** | all modules | A streak that means "fully logged", not "opened the app" |

Meta-honest framing: when coverage is poor, say so and shrink the claim. That is the same principle
as the doc's honesty rule, applied to the tracking layer itself.

---

## 8. 🟡 Alcohol — one object, then a dose–response

Three representations exist today (`WeightEntry.alcoholUnits`, `RecoveryEntry.alcoholDrinks`, and
the dossier page's own math) with two different kcal constants — audit **S3**. After unifying:

- **Dose → next-day response curve**: drinks vs next-day RHR, HRV, sleep efficiency, craving count.
  The RHR ladder already exists in the roadmap (`ROADMAP_PHASE_5_6.md:14`, ≥50 / ≥55) — this makes it
  continuous instead of two thresholds.
- **Recovery half-life** 🟢 — days-since-last-drink until RHR and HRV return to personal baseline.
  Fully derivable from stored data, personal rather than generic, and it reframes a clean streak as a
  measurable physiological return instead of a counter.
- **"Cost of a night" card** 🟡 — one bundle: next-day RHR +x, HRV −y, sleep efficiency −z, cravings
  +n, kcal +m, € (from `RecoverySettings.drinkCostEur`). Every input already stored. Pairs the
  existing money-saved calculator with the physiological side.

---

## 9. 🔵 Small new inputs with high explanatory power

Ranked by information gained per tap:

1. **Last caffeine time** — one tap; among the strongest single predictors of sleep latency.
2. **Discomfort tag per session** (0–3) — with `GarminActivity.distanceM` this yields an
   **onset-distance curve**: at what distance discomfort starts, and whether it moves after a
   position or training change. A textbook n-of-1 candidate for the Phase 7 experiment engine.
3. **Wake count / "felt rested"** — one field; converts sleep from duration-only to continuity.
4. **Photoperiod** — *no input and no API needed*: sunrise/sunset are computable from date + a fixed
   home coordinate. At Belgian latitude daylight swings roughly 8 h to 16.5 h across the year, which
   is a real seasonal covariate for mood, sleep timing and training that is currently invisible.
5. **`spo2` / `respiration`** — declared kinds with zero code references. Respiration rate is a
   reasonable early illness/alcohol signal once surfaced.

---

## 10. 🟡 Composites worth building (and the framing that keeps them honest)

**a. Personal-baseline z-scores.** Every domain (sleep duration, regularity, HRV, RHR, load, mood,
coverage) expressed as deviation from **your own** rolling mean and SD. Sidesteps population norms
entirely — no reference ranges, no percentiles, no medical claim surface — and makes domains
comparable on one radar.

**b. Regime detection, not trend fitting.** `MacroRegimeSnapshot` already applies this idea on the
investing side. Health data behaves the same way: it steps between regimes rather than trending
smoothly. Detecting "your baseline changed on ~this date" is more useful and more honest than fitting
a slope through a level shift.

**c. Confidence on every number.** From audit §3.2 — each metric renders with its coverage. A metric
that cannot state its coverage should not render.

**d. Event-window exclusion.** `EventTag` (travel / illness / holiday) exists and is unused by any
formula. Every rolling metric should optionally exclude tagged windows, and say that it did.

---

## 11. What I would *not* build

Discipline matters as much as ideas here:

- **A single "health score."** Aggregating aggregates destroys attribution; when it moves you cannot
  say why. The app's existing multi-pillar structure is better.
- **Population percentiles** ("top 12% of men your age"). Wrong denominator, invites medical
  interpretation, and the app's honesty rule exists to avoid exactly this.
- **Relapse probability.** A calibrated probability cannot be validated on n=1, and the failure mode
  is severe in both directions. Descriptive exposure flags only.
- **More sleep scores stacked on `computeSleepScore`.** Fix the inputs (S16, audit S4) before adding
  layers on top.
- **Anything requiring daily manual entry of more than ~3 taps.** Coverage is already the binding
  constraint (audit S1); every new required field makes the primary defect worse.

---

## 12. If you build five things

Ranked by value ÷ effort, all 🟢 or 🟡:

1. **Katch–McArdle BMR** (§2a) — **shipped** in `energyBmr.ts` when measured BF% exists; falls back to Mifflin / stub.
2. **Sleep timing pack** (§1) — midsleep, regularity, efficiency (needs the S16 split). Largest analytical gap in the app; entirely free.
3. **Craving action efficacy + hazard map** (§5a, §5b) — two `groupBy`s over data already collected; the most decision-useful output in the recovery module.
4. **RPE vs device divergence** (§4) — both numbers stored, never compared; a genuine recovery signal for the cost of a subtraction.
5. **Mode adherence** (§6) — declared intent vs measured behaviour, zero new input.

Then: **"cost of a night"** (§8) as the first composite, because every input is already on disk and it
turns scattered fields into one thing worth opening the app for.

---

*All proposals are descriptive metrics computed from the user's own data against the user's own
baselines. None constitutes medical advice, diagnosis, or prediction — same rule as the formula book.*
