# MY PENS — Eat / Sleep / Energy Analysis Formulas

> Exhaustive formula index for external LLM review. Single-user health tracker.
> **Honesty rule:** Device estimates — not metabolic TDEE. Never invent medical claims.
> Generated for the energy stack ship (Phases A–D). Paths are repo-relative from `mypens/`.

---

## 1. Energy day ledger (full stack)

**API:** `GET /api/energy-balance?date=YYYY-MM-DD` → `lib/energyBalance.ts` → `getDayEnergyBalance`

### Formula

```
estimatedOut = BMR + EAT + NEAT
delta        = foodKcal − estimatedOut
activityKcal = EAT + NEAT   // legacy "Activity" aggregate
```

| Symbol | Meaning | Source |
|--------|---------|--------|
| `foodKcal` | Sum of `FoodEntry.kcal` for the date | Prisma aggregate |
| `BMR` | Resting estimate | `lib/energyBmr.ts` |
| `EAT` | Exercise activity thermogenesis (sessions) | Training / Garmin FIT / PushedWorkout |
| `NEAT` | Non-exercise residual | `lib/energyNeat.ts` |

### BMR (`lib/energyBmr.ts`)

1. **Katch–McArdle** if plausible `WeightEntry.bodyFatPct` (3–60%) on/before date: `FFM = kg·(1 − BF%/100)`; `BMR = round(370 + 21.6·FFM)`.
2. Else **Mifflin–St Jeor** if `UserSettings.heightCm`, `birthYear`, `sex` (`male`\|`female`) **and** latest `WeightEntry.scaleKg` on/before date:

   ```
   male:   round(10·kg + 6.25·cm − 5·age + 5)
   female: round(10·kg + 6.25·cm − 5·age − 161)
   age = calendarYear − birthYear (clamped 10–120)
   ```

3. Else **stub:** `round(22 · kg)` (`BMR_KCAL_PER_KG` in `lib/energyWeek.ts`).
4. Else **missing:** `0` (flagged `bmrMissing` on week days).

Label always exposed (`bmrLabel` / `bmrMethod`). `muscleMassKg` is stored but **not** used in BMR.

### EAT — session kcal extraction (`lib/energyKcalExtract.ts`)

Priority for each `TrainingEntry`:

1. `TrainingEntry.calories` column (`> 0`) → origin `column`
2. `externalRaw` JSON: first positive of `activeKilocalories`, `calories`, `totalEnergyKcal`, `kilocalories`
3. Notes regex: `/(\d+(?:\.\d+)?)\s*kcal\b/i`

Also counted toward EAT:

- `GarminActivity.calories` (FIT archive) when `> 0`
- Unpromoted `PushedWorkout` with calories (HC/HK inbox), unless already imported (`externalId` match)
- Dedup: shared `dedupeSessions()` (time-overlap ≥50% of shorter) across FIT / TrainingEntry / pushed — prefers FIT archive over Strava/HC duplicates; keeps non-overlapping evening sessions (E3–E5)

### NEAT (`lib/energyNeat.ts`) — pick **one** path (never both)

1. **Preferred — device Active residual** when `kind=active_calories` present **and** `deviceActive ≥ Σ(session EAT)`:

   ```
   neatKcal = max(0, deviceActive − Σ(session EAT))
   ```

2. Else **steps model** when `kind=steps` present (also if Active exists but Active &lt; sessions — HC under-report fallback).
   **Fixed 2026-08-01 (E1):** gross steps→kcal minus session EAT so walk/run session burn is not
   re-counted when day steps already include those sessions:

   ```
   perStep = 0.04 · (weightKg / 70)   // STEPS_KCAL_BASE @ STEPS_REF_KG
   gross   = round(steps · perStep)
   neatKcal = max(0, gross − Σ(session EAT))
   ```

3. Else `neatKcal = 0`, source `none`.

### Incomplete capture

```
foodCoverage = foodEntryCount > 0   // at least one FoodEntry that day

incompleteCapture =
  foodIncomplete
  || !foodCoverage
  || (sessionCount > 0 && eatKcal === 0)
  || (sessionsMissingKcal > 0 && eatKcal === 0)
```

Zero-food mornings are incomplete — UI must hide the bold delta (not show a confident −BMR artefact).
`foodIncomplete` is the user tag `food_incomplete` on `DayEntry`. Session-kcal gaps clear once structured kcal is present on sessions.

### Device reference (Phase C — never summed)

From `GarminDailyMetric` kinds: `steps`, `active_calories`, `resting_calories`, `total_calories` (and legacy `calories` as total fallback).

UI shows **MY PENS `estimatedOut` vs Garmin Total** side-by-side. Hard rule: **never add Garmin Total / Resting / day Active into the MY PENS sum** (Total already includes Active+Resting).

Disclaimer string in `getDayEnergyBalance`:

> Device estimates — not metabolic TDEE. Stack = Food − (BMR + EAT sessions + NEAT). Garmin Total/Resting/Active are reference only…

### UI

- Web: `components/food/EnergyBalanceCard.tsx`
- Mobile: `mypens-mobile/app/(tabs)/food.tsx` energy strip

---

## 2. Energy week (7-day) and 30-day windows

**API:**

- `GET /api/energy-balance?week=1&date=` → `getWeekEnergyRecap` → `getRollingEnergyRecap(7)`
- `GET /api/energy-balance?month=1&date=` → `getMonthEnergyRecap` → `getRollingEnergyRecap(30)`

**Window helpers** (`lib/energyWeek.ts`):

- `rolling7Window(asOf)` = inclusive 7 days ending `asOf` (`from = asOf − 6`)
- `rollingNWindow(asOf, N)` = inclusive N days ending `asOf`

### Per-day inside window

Same stack as day ledger (BMR + EAT + NEAT). Raw builder in `getRollingEnergyRecap` folds `activityKcal = eat + neat`.

### Imputation (`buildWeekEnergyRecap`)

- **Tracked** = `foodKcal > 0 OR activityKcal > 0`
- Untracked days get mean food / activity / eat / neat of tracked days → `imputed: true`
- `weekNetKcal` = sum of daily `delta` including imputed
- `trackedNetKcal` = sum on tracked days only
- `avgDailyNetKcal` = `round(weekNetKcal / days.length)`

### Weight calibration (Phase D)

`lib/energyWeightCalibration.ts` → `calibrateWeekVsWeight(weekNetKcal, weights)`

```
predictedKg = round((weekNetKcal / 7700) · 100) / 100   // KCAL_PER_KG = 7700
observedKg  = end.scaleKg − start.scaleKg
residualKg  = observedKg − predictedKg
residualKcal = round(residualKg · 7700)
```

Needs ≥2 distinct weight dates in the window (±1 day pool). **Soft note only** — does not rewrite burn. Surfaced on week + 30d cards (web + mobile).

### Thyroid soft context

Latest `BloodworkPanel` → `schildklierRead` (`lib/bloodworkThyroidRead.ts`). Attached as `thyroidContext` on week/30d JSON. **Context only — never auto-adjusts BMR/EAT/NEAT.**

---

## 3. Anti-double-count rules (hard)

| Never combine | Why |
|---------------|-----|
| Garmin **Total** + anything into MY PENS out | Total already = Active + Resting |
| Garmin **day Active** + Σ(sessions) + steps-NEAT | Use residual **or** steps, not both |
| Session kcal twice (FIT / Strava / HC / garmin TrainingEntry) | `dedupeSessions()` time-overlap (≥50% shorter); prefer FIT |
| Steps-model NEAT + full session EAT | `neatKcal = max(0, steps→kcal − Σ EAT)` (E1 fixed 2026-08-01) |
| Inbox `PushedWorkout` + already-imported TrainingEntry | Skip by `externalId` |
| NEAT residual + steps model | Exclusive pick in `estimateNeat` |

**Safe:** `BMR_estimate + Σ(session EAT) + residual NEAT` **or** steps-NEAT with session EAT subtracted.

---

## 4. Training load / kcal ingestion (Phase A)

### Schema

- `TrainingEntry.calories Int?` — migration `prisma/migrations/20260725190000_training_calories_energy_profile/`
- Optional Mifflin profile on `UserSettings`: `heightCm`, `birthYear`, `sex`

### Upsert drafts (`lib/integrations/_shared/import.ts`)

`importDrafts(source, items)`:

- **Create** when `(source, externalId)` missing
- **Update** when row exists and new payload improves kcal / raw / notes (fixes create-only skip that left Activity at 0)
- Returns `{ created, updated, skipped }`

### Mappers set structured `calories`

| Source | File | Field |
|--------|------|-------|
| Garmin | `lib/integrations/garmin/mapping.ts` | `activeKilocalories` |
| Strava | `lib/integrations/strava/mapping.ts` | `calories` (single-entry path) |
| Health Connect | `lib/integrations/healthconnect/mapping.ts` | `totalEnergyKcal` |
| HealthKit | `lib/integrations/healthkit/mapping.ts` | `totalEnergyKcal` |

HC/HK **ingest** upserts `PushedWorkout` when kcal arrives later (`app/api/integrations/healthconnect/ingest/route.ts`, `…/healthkit/ingest/route.ts`).

### Training metrics engine (Fitness / Freshness / GAP / peaks)

**Module:** `lib/engines/trainingMetrics/`

Daily **PLU** (`scripts/lib/trainingLoad.mjs`) feeds Banister impulse–response:

```
CTLₜ = α₄₂·loadₜ + (1−α₄₂)·CTLₜ₋₁     // Fitness
ATLₜ = α₇·loadₜ  + (1−α₇)·ATLₜ₋₁      // Fatigue
TSBₜ = CTLₜ − ATLₜ                      // Form / Freshness
ACWR = EWMA₇ / EWMA₂₈                   // null until chronic ≥ 5
α = 1 − e^(−1/τ)
```

Also: Foster monotony/strain (7d), Minetti GAP, Edwards zone Relative Effort, peak rolling averages, session efficiency (kcal/km, HR/km).

**Wired:** `lib/engines/cockpitData.ts` enriches each series day with `ctl`/`atl`/`tsb`/`acwr` (90d lookback) and returns `fosterWeek` + `fitnessFreshness`. No dedicated UI yet — payload only.

**Honesty:** descriptive load models, not medical readiness. GAP activity-level totals are coarse without GPS streams.

GAP identity: `gapSpeed = speed × Cr(grade)/Cr(0)` (uphill → faster equivalent flat pace).

**Out of scope:** Strava segments, matched runs, segment PRs — not needed for v1; would require a segment catalog and GPS streams we do not store.

---

## 5. Steps / wellness persistence (Phase B/C)

`lib/integrations/garmin/dailiesSync.ts` → `upsertWellnessFromDaily`

Writes `GarminDailyMetric` kinds:

| kind | Garmin field |
|------|----------------|
| `steps` | `steps` |
| `active_calories` | `activeKilocalories` |
| `resting_calories` | `bmrKilocalories` or `restingKilocalories` |
| `total_calories` | `totalKilocalories` or Active+Resting |
| `calories` | same as total (dump/cockpit compat) |

Wired from:

- `syncSleep` (pull dailies) — also persists wellness
- Garmin webhook dailies (`app/api/integrations/garmin/webhook/route.ts`)
- Cron still calls `syncSleep` (`app/api/integrations/garmin/cron/route.ts`)

Dump import (`scripts/import-garmin-dump.py`) historically wrote `steps` + `calories`; live path now fills Active/Resting/Total explicitly.

---

## 6. Food macros & nutrient scoring

### Daily macros

- Soft targets: local storage / mobile AsyncStorage (default cues e.g. 2000 kcal / 150 P / 200 C / 70 F) — **not** engine-enforced TDEE
- Totals = sum of `FoodEntry` macros for the selected date
- Portion scaling: `lib/foodPortion.ts` → `scalePortion` (macros + micros × scale)

### Soft tags & micros (`lib/foodMicros.ts`)

- `inferFoodTags`: e.g. high_protein if `protein / (kcal/100) ≥ 8`; high_fiber if `fiber ≥ 5`; name heuristics for UPF / plant / dairy / alcohol
- `softNutrientFlags`:
  - fiber_low if `fiberG < 25`
  - protein_below_cue if `protein < 0.7 · proteinTarget`
  - sodium_high if `sodiumMg > 2300`
- Educational only — not coaching/medical

### Planner food soft-rules (`lib/planner/planWeek.ts` → `FOOD_SOFT`)

Affects **sports planner** notes/caps, not the energy ledger sum:

- Sleep avg `< 6.5h` → volume capped
- Protein floor / very-low kcal / coverage ratio vs lookback window (`minCoverage`)
---

## 7. Sleep scoring / quality / sync

### Manual + synced sleep entry

`SleepEntry`: `hours`, `quality` (1–5), optional `hrv`

### Garmin sleep sync (`lib/integrations/garmin/sleepSync.ts`)

- Pulls wellness `/dailies` (and push sleeps)
- `hours = sleepingSeconds / 3600`
- Quality from HRV: `<30→1`, `<45→2`, `<60→3`, `<75→4`, else `5`
- **Manual entry always wins** (existing row → skip)

### Readiness score (`lib/readinessMetrics.ts`)

```
sleepScore = round(min(1, hours/8)·60 + ((quality−1)/4)·40)   // 0–100
hrvReadiness = clamp(0..100, round((hrv / baseline14d)·100))
```

Baseline: mean HRV of up to 14 prior nights with HRV (≥3 samples). Labels via `readinessLabel` (≥80 Full recovery …).

### Period Review sleep hours band (`scripts/lib/periodAnalyze.mjs`)

Domain score from sleep hours (window-scoped): ~7–8.5h → high band; lower hours → lower score. Composite with steps/HRV/stress — **advice always relative to named window**.

### HC sleep

Companion → `/api/integrations/healthconnect/sleep-ingest` (separate from exercise). Manual still preferred when present.

---

## 8. Weight retention (touches energy narrative, not day stack)

`lib/retentionModels.ts` — scale confounders for **true weight** decomposition (do not modify core logic casually):

| Model | Sketch |
|-------|--------|
| Creatine | Loading ramp to ~1 kg / 7d; maintenance cold-start → 0.4 kg / 28d; post-load saturated 1.0 |
| Alcohol | `kcal = units·56`; retention peak `units·0.25` decay over 48h |
| Glycogen | excess carbs over 150g → water-bound estimate |
| Sodium | highSodium +0.30 kg; restaurant +0.15 kg |
| Hard training | +0.30 kg inflammatory water |

Energy calibration (`7700 kcal ≈ 1 kg`) is **independent** soft check — does not feed retention models automatically.

---

## 9. Thyroid soft reads (energy context only)

`lib/bloodworkThyroidRead.ts` → codes `tsh`, `ft4`, `ft3` via `normalizeMarkerCode`.

Restates lab ref flags (below/within/above). Disclaimer: not diagnosis. Attached to week/30d energy JSON; **never rewrites burn**.

---

## 10. Verdict / period-review / cockpit (eat–sleep–energy touchpoints)

| Surface | Window | Role |
|---------|--------|------|
| Fuel energy day/week/30d | 1 / 7 / 30 | Primary energy math (this doc §§1–2) |
| Period Review cockpit | User-selected multi-month | Steps/sleep/HR charts from Garmin dump metrics (`lib/engines/cockpitData.ts`, `scripts/lib/periodAnalyze.mjs`) — **not** the Fuel stack formula |
| Weekly feedback reports | Calendar week | Agent transcript + health narrative (`WeeklyFeedbackReport`) — separate from ledger |
| Planner soft food/sleep | Lookback days | Caps sessions; does not alter Fuel delta |
| Labs wearable context | ~10d around draw (`lib/bloodworkWearableContext.ts`) | Context near bloodwork — not TDEE |

Period Review step/sleep domain scores are **window-relative**; do not conflate with Fuel `delta`.

---

## 11. 7-day and 30-day windows — index

| Feature | Window | Path |
|---------|--------|------|
| Energy week recap | 7 | `getWeekEnergyRecap` / `?week=1` |
| Energy month recap | 30 | `getMonthEnergyRecap` / `?month=1` |
| Energy range | arbitrary `from`–`to` | `getEnergyBalanceRange` |
| Garmin activity cron default | 7 (max 30) | `app/api/integrations/garmin/cron/route.ts` |
| Garmin sleep/dailies sync default | 30 | `syncSleep` / `syncDailiesWellness` |
| Garmin backfill | ≤90 (default 30) | `lib/integrations/garmin/webhook.ts` `requestBackfill` |
| HRV readiness baseline | up to 14 prior nights | `lib/readinessMetrics.ts` |
| Planner food coverage | `foodWindowDays` | `lib/planner/planWeek.ts` |
| Period Review horizons | multi-month + last-7 deep dive | `scripts/lib/periodAnalyze.mjs` |
| Weight calib on energy | same as 7 or 30 window | `calibrateWeekVsWeight` |
| Skipped HC tombstone retention | 90d default | `lib/integrations/_shared/skippedTombstoneRetention.ts` |

---

## 12. File index

| Role | Path |
|------|------|
| Day/rolling energy | `lib/energyBalance.ts` |
| Kcal extract | `lib/energyKcalExtract.ts` |
| BMR | `lib/energyBmr.ts` |
| NEAT | `lib/energyNeat.ts` |
| Week builder / windows | `lib/energyWeek.ts` |
| Weight calibration | `lib/energyWeightCalibration.ts` |
| API | `app/api/energy-balance/route.ts` |
| Web UI | `components/food/EnergyBalanceCard.tsx`, `WeekEnergyRecapCard.tsx`, `app/food/page.tsx` |
| Mobile Fuel | `mypens-mobile/app/(tabs)/food.tsx` |
| Draft upsert | `lib/integrations/_shared/import.ts` |
| Garmin wellness | `lib/integrations/garmin/dailiesSync.ts` |
| Garmin sleep | `lib/integrations/garmin/sleepSync.ts` |
| Garmin map/sync/webhook | `mapping.ts`, `sync.ts`, `app/api/integrations/garmin/webhook/route.ts` |
| Food micros | `lib/foodMicros.ts` |
| Sleep readiness | `lib/readinessMetrics.ts` |
| Thyroid soft | `lib/bloodworkThyroidRead.ts` |
| Weight retention | `lib/retentionModels.ts` |
| Tests | `tests/fuelLabsEnergy.test.ts`, `tests/weekEnergyThyroid.test.ts` |
| Migration | `prisma/migrations/20260725190000_training_calories_energy_profile/` |

---

## 13. Known gaps & open research questions (for external LLM)

1. **Mifflin profile** — fields exist but no settings UI yet; without height/age/sex, BMR falls back to stub ~22 kcal/kg **unless** `bodyFatPct` is logged (then Katch–McArdle wins).
2. **Steps→kcal curve** — linear 0.04×weight/70 is a rule of thumb; research better age/sex/terrain models without claiming lab accuracy.
3. **Session vs day Active attribution** — residual assumes device Active ⊇ sessions; Garmin sport definitions may diverge.
4. **Multi-source same workout** (Garmin + HC + Strava) — shared `dedupeSessions()` time-overlap dedup (fixed 2026-08-01 E3–E5/T1); legacy rows without `startedAt` use synthetic noon windows.
5. **Strava strength multi-row** — parent `calories` not split across parsed exercises (left null on sub-rows).
6. **HC steps/Active** — ingested via companion → `dayMetrics` on HC ingest (`GarminDailyMetric` kinds `steps` / `active_calories`). Read-time precedence prefers Garmin over HC when both exist (D1). Steps-model NEAT subtracts session EAT (E1 fixed 2026-08-01).
7. **Sleep quality from HRV** — coarse buckets; not compared to Garmin’s own sleep score.
8. **7700 kcal/kg** — popular heuristic; short windows dominated by water/glycogen (calibration disclaimer already states this).
9. **Thyroid → energy** — intentionally non-causal; research whether soft “context chips” should appear on day strip too.
10. **Period Review vs Fuel** — two scoring philosophies; unifying narrative copy without merging formulas may reduce user confusion.
11. **Re-fetch Garmin activity detail** when webhook summary lacks kcal — upsert helps on next sync; dedicated “kcal was 0” re-fetch not separate from cron/webhook.
12. **Offline / timezone** — dates are local-string `yyyy-mm-dd`; edge cases around midnight offsets remain.

---

## 14. How to improve further (research agenda)

- Validate residual NEAT vs independent step models on Jerome’s bike-heavy weeks (correlation + residual vs scale).
- Optional opt-in bias correction from multi-week calibration residuals (never silent rewrite).
- Ingest HC/HealthKit daily steps + active energy for non-Garmin days.
- Store per-session sport MET table as fallback when device kcal missing (clearly labeled estimate).
- Align Period Review sleep bands with readiness `computeSleepScore` for one sleep language.
- Document / UI for height–age–sex so Mifflin activates without schema-only fields.

---

*End of formula book. No secrets / tokens / connection strings included.*
