# MY PENS — Project Overview
**Personal health tracking app · Built with Next.js, TypeScript, Tailwind, Prisma + SQLite**

---

## What is MY PENS?

A local-first personal health tracker that runs on your own computer. No accounts, no cloud, no subscriptions — all data stays in a local SQLite database. Designed to be modular: each health dimension is its own section, and you can use just the ones you care about.

The name stands for the five core tracking areas: **M**easurements, **P**erformance (training), **E**ating, **N**utrition (weight/body comp), **S**leep.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Prisma ORM + SQLite (local file) |
| Charts | Recharts |
| Icons | Lucide React |

---

## What Is Built

### Phase 1 — Weight Tracker
**Route:** `/weight`

Logs daily scale weight and calculates an **adjusted true weight** by stripping temporary water retention from known confounders, then anchors it against a rolling trend baseline.

**Retention model (v3)** — estimates and subtracts water held due to:
- Creatine supplementation (dose × days on — loading vs maintenance phases)
- Alcohol consumption (units + hours since, peak × decay curve)
- High carb intake (glycogen-bound water, excess above 150 g/day)
- **Hard training** (−0.30 kg DOMS/inflammation — quantified, not just flagged)
- **High sodium** (−0.30 kg osmotic retention — quantified)
- **Restaurant meal** (−0.15 kg hidden-sodium proxy — quantified)
- Flight / sedentary day and illness (flagged, band-widening)

**Signal layer (v3 — history-based):**
- **Rolling baseline**: EWMA of last 7 true-weight readings (decay 0.85/day). Low-confidence entries weighted ×0.7 so a noisy day doesn't drag the anchor. Requires ≥ 3 prior entries.
- **Dynamic uncertainty band**: derived from actual recent volatility (std dev of last 7 entries × 1.5, clamped to [0.15, 1.0] kg). Falls back to static ±0.2/0.4/0.7 until enough history exists.
- **Outlier detection**: scale weight > 2.5× dynamic band from baseline is flagged (red dot on chart + warning in breakdown).

**Other features:**
- Scale weight entry with optional Tanita body composition data (body fat %, muscle mass, bone mass, body water %, visceral fat)
- Tanita reliability flag: warns when BIA readings are likely inaccurate
- Confidence level (high / medium / low) per entry based on number of active confounders
- 30-day trend chart: scale weight · adjusted weight · 7-day baseline · retention delta · uncertainty band
- **Body composition trend chart**: body fat % and muscle mass over time from Tanita data, with toggle to include/exclude unreliable readings
- Expandable per-entry breakdown: all quantified retention factors shown with kg, plus context flags
- **Backtest harness**: 5 synthetic scenarios (creatine loading, refeed, city trip, deload, 4-day retention event) replayed against the algorithm with pass/fail evaluation

**Input modes:** 3-tab form (Scale / Context / Tanita) or Quick mode (scale only)

---

### Phase 2 — Food Log
**Route:** `/food`

Daily meal tracker with macros. Designed for people who track calories and protein, with optional depth for full macro breakdowns.

**Features:**
- Log food items per meal: Breakfast / Lunch / Dinner / Snack
- Fields per item: name, kcal, protein, carbs, fat, fiber, notes
- **Configurable daily targets**: set your own kcal / protein / carbs / fat targets via a collapsible settings panel — saved to localStorage, persists across sessions
- Daily macro progress bars vs your targets (turns red if over)
- Today's food grouped by meal type
- Delete individual items

**Input modes:** Quick (name + kcal + protein only) or Detailed (all macros)

---

### Phase 3 — Sleep
**Route:** `/sleep`

Sleep duration and quality tracker with optional HRV logging.

**Features:**
- Log bedtime and wake time → auto-calculates duration (handles midnight crossover)
- Quality rating 1–5 with labels
- Optional HRV (ms) field
- 30-day trend chart: hours + quality overlay
- Average hours / average quality shown
- One entry per date (updating same date overwrites)

**Input modes:** Quick (bedtime + wake + quality) or Detailed (+ HRV + notes)

---

### Phase 3 — Training Log
**Route:** `/training`

Exercise tracker at the set level. Designed for strength training but works for any exercise.

**Features:**
- Log exercise name, sets, reps, weight (kg), RPE (1–10), notes
- Auto-calculates **volume** per set: sets × reps × weight
- Live volume preview before saving
- Session volume aggregated by date
- Weekly volume trend chart
- Recent sessions history

**Input modes:** Quick (exercise + sets + reps + weight, no RPE/notes) or Detailed

---

### Phase 4 — Body Measurements
**Route:** `/measurements`

Track body dimensions over time. Useful alongside weight to see body recomposition.

**Features:**
- Log up to 8 measurements per entry: waist, chest, hips, left arm, right arm, left thigh, right thigh, neck (all in cm)
- One entry per date (updating same date overwrites)
- Latest entry summary with delta vs previous measurement (green if down, red if up)
- Multi-line trend chart — toggle each body part on/off independently
- Full history table

**Input modes:** Quick (waist + chest + hips only) or Detailed (all 8 measurements)

---

### Phase 4 — Dashboard
**Route:** `/dashboard`

Weekly overview that surfaces the most important number from each module at a glance.

**Cards shown:**
- **Weight:** latest true weight, 7-day average, trend direction vs 7 days ago
- **Food:** today's kcal + macros breakdown, 7-day average kcal
- **Sleep:** last night's hours + quality dots, 7-day averages for hours / quality / HRV
- **Training:** sessions this week, total volume this week, top 3 exercises by volume
- **Measurements:** latest waist + chest with delta vs previous entry

Quick-log bar at the bottom to jump directly to any module.

---

### Phase 4 — Export to CSV
**Built into the Dashboard**

Download all data as CSV, module by module or everything at once.

---

### Phase 4 — Presets System (all modules)
**Available in every entry form**

Save any filled-in form as a named preset and re-apply it in one click. Sorted by most-used first. Each module uses its own preset namespace (`module` field in DB).

| Module | What the preset stores |
|---|---|
| Food | Meal type, food name, all macros |
| Training | Exercise name, sets, reps, weight, RPE |
| Sleep | Bedtime, wake time, quality |
| Weight | Context settings (creatine dose, days on, training flag) |
| Measurements | Any measurement values |

---

### Quick-entry Mode (all modules)
**Available in every entry form**

A toggle (⚡ Quick / ⚙ Detailed) at the top of every form.

| Module | Quick shows | Detailed adds |
|---|---|---|
| Weight | Date + scale weight | Tanita data, context (alcohol, carbs, creatine, confounders) |
| Food | Meal + name + kcal + protein | Carbs, fat, fiber, notes |
| Sleep | Bedtime + wake time + quality | HRV, notes |
| Training | Exercise + sets + reps + weight | RPE, notes |
| Measurements | Waist + chest + hips | Arms, thighs, neck, notes |

---

## What Could Still Be Built

### High value / natural next steps

| Idea | Description |
|---|---|
| **Mobile app** | Native iOS/Android app via Expo + Supabase. See `MOBILE_SPEC.md` for full spec and migration plan. |
| **Weekly training programme builder** | Define a programme (e.g. Push/Pull/Legs) with template workouts. "Start session" pre-fills the training log from the template |
| **Workout history per exercise** | View all-time logs for a specific exercise (progression chart, personal best, volume over time) |
| **Sleep debt tracker** | Track cumulative sleep deficit against a target (e.g. 7.5h/night) |
| **Notes / journal** | A freeform daily note attached to a date — mood, energy, general observations |

### Medium complexity

| Idea | Description |
|---|---|
| **PDF / weekly report** | Auto-generate a summary PDF for the week |
| **Goal setting** | Set a target weight, waist measurement or weekly training sessions. Progress bar and ETA shown on dashboard |
| **Streaks / consistency tracking** | Track how many consecutive days you've logged each module |
| **Import from CSV** | Upload a CSV to bulk-import historical data |

### Lower priority / nice to have

| Idea | Description |
|---|---|
| **Dark mode** | Tailwind supports it — mainly cosmetic work |
| **Notification reminders** | Browser notifications to remind you to log at set times |
| **AI-powered insights** | Weekly summary with observations ("your sleep quality correlates with training days") |

---

## Current Limitations (honest)

- **No authentication** — anyone with access to the machine can see/edit data. Fine for personal use.
- **SQLite only** — not designed for multiple users writing simultaneously.
- **No automatic backups** — the database is a single file (`prisma/dev.db`). Manual backups recommended.
- **No data validation on date overlaps for food/training** — you can log multiple food/training entries for the same date (by design), but logging weight twice on the same date creates two rows rather than overwriting.

---

## Database Schema Summary

```
WeightEntry     — scale weight, Tanita data, retention model inputs + outputs, confounders
                  Note: sodiumKg and hardTrainingKg are NOT stored — computed on the fly
                  from highSodium / restaurantMeal / hardTraining flags in the GET route.
                  trueWeightKg in DB is v3-accurate for new entries; the GET route recomputes
                  it from stored components for all entries (old + new) to ensure consistency.
FoodEntry       — meal type, name, macros (kcal/protein/carbs/fat/fiber)
SleepEntry      — bedtime, wake time, hours, quality, HRV (unique per date)
TrainingEntry   — exercise, sets, reps, weightKg, RPE, volume
BodyMeasurement — waist/chest/hips/arms/thighs/neck in cm (unique per date)
Preset          — module, name, JSON data blob, usedCount
```

---

## Running the App

```bash
cd my-pens-app
npm install           # first time only
npx prisma generate   # after any schema changes
npm run dev
```

Then open `http://localhost:3000`

---

*Last updated: March 2026 — Phases 1–5 complete. Weight tracker upgraded to v3 signal model (rolling baseline, dynamic band, outlier detection, quantified sodium + training retention). Mobile spec in `MOBILE_SPEC.md`.*
