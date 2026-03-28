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
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Prisma ORM + SQLite (local file) |
| Charts | Recharts |
| Icons | Lucide React |

---

## What Is Built

### Phase 1 — Weight Tracker
**Route:** `/weight`

Logs daily scale weight and calculates a **true weight** by stripping out temporary water retention from known confounders.

**Features:**
- Scale weight entry with optional Tanita body composition data (body fat %, muscle mass, bone mass, body water %, visceral fat)
- **Retention model** that estimates and subtracts water held due to:
  - Creatine supplementation (dose × days on)
  - Alcohol consumption (units + hours since last drink)
  - High carb intake (glycogen water)
  - Hard training the day before
- Tanita reliability flag: warns when BIA readings are likely inaccurate (not a morning reading, alcohol, hard training)
- 30-day trend chart: scale weight vs true weight
- History table with breakdown per entry

**Input modes:** 3-tab form (Scale / Context / Tanita) or Quick mode (scale only)

---

### Phase 2 — Food Log
**Route:** `/food`

Daily meal tracker with macros. Designed for people who track calories and protein, with optional depth for full macro breakdowns.

**Features:**
- Log food items per meal: Breakfast / Lunch / Dinner / Snack
- Fields per item: name, kcal, protein, carbs, fat, fiber, notes
- Daily macro progress bars vs configurable targets
- Today's food grouped by meal type
- Delete individual items
- History view

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
- Top exercises by volume this week

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

Weekly overview that surfaces the most important number from each module at a glance, without having to visit each section.

**Cards shown:**
- **Weight:** latest true weight, 7-day average, trend direction (↑↓) vs 7 days ago
- **Food:** today's kcal + macros breakdown, 7-day average kcal
- **Sleep:** last night's hours + quality dots, 7-day averages for hours / quality / HRV, days logged out of 7
- **Training:** sessions this week, total volume this week, top 3 exercises by volume
- **Measurements:** latest waist + chest with delta vs previous entry

Quick-log bar at the bottom to jump directly to any module.

---

### Phase 4 — Export to CSV
**Built into the Dashboard**

Download all your data as a CSV file, module by module or everything at once.

**Options:**
- Weight only
- Food only
- Sleep only
- Training only
- Measurements only
- **All modules** (one file, each section separated by a header row)

---

### Phase 4 — Presets System (all modules)
**Available in every entry form**

Save any filled-in form as a named preset and re-apply it in one click. Useful for recurring meals, standard workout exercises, or consistent sleep windows.

**How it works:**
- Fill in a form → click "Save as preset" → give it a name
- Next time: click "Presets" dropdown → select a preset → form fills automatically
- Presets are sorted by most-used first
- Delete any preset with a hover button
- Stored in the local database (persists across sessions)

**What gets saved per module:**
| Module | What the preset stores |
|---|---|
| Food | Meal type, food name, all macros |
| Training | Exercise name, sets, reps, weight, RPE |
| Sleep | Bedtime, wake time, quality |
| Weight | Context settings (creatine dose, days on, training flag) |

---

### Quick-entry Mode (all modules)
**Available in every entry form**

A toggle (⚡ Quick / ⚙ Detailed) at the top of every form. Quick mode hides optional fields — you can log in under 10 seconds. Detailed mode shows everything.

| Module | Quick shows | Detailed adds |
|---|---|---|
| Weight | Date + scale weight | Tanita data, context (alcohol, carbs, creatine) |
| Food | Meal + name + kcal + protein | Carbs, fat, fiber, notes |
| Sleep | Bedtime + wake time + quality | HRV, notes |
| Training | Exercise + sets + reps + weight | RPE, notes |
| Measurements | Waist + chest + hips | Arms, thighs, neck, notes |

---

## What Could Still Be Built

### High value / natural next steps

| Idea | Description |
|---|---|
| **Calorie targets** | Let user set daily kcal / protein / carb / fat targets. Food log shows progress bars vs target (structure already exists, just needs a settings page) |
| **Body composition trend** | Chart body fat % and muscle mass over time from Tanita data (data is already stored, just needs a dedicated view) |
| **Weekly training programme builder** | Define a programme (e.g. Push/Pull/Legs) with template workouts. "Start session" pre-fills the training log from the template |
| **Workout history per exercise** | View all-time logs for a specific exercise (progression chart, personal best, volume over time) |
| **Sleep debt tracker** | Track cumulative sleep deficit against a target (e.g. 7.5h/night) |
| **Notes / journal** | A freeform daily note attached to a date — mood, energy, general observations |
| **Mobile-optimised layout** | The app works on mobile but isn't specifically optimised. A bottom nav bar + larger tap targets would improve daily usability significantly |

### Medium complexity

| Idea | Description |
|---|---|
| **PDF / weekly report** | Auto-generate a summary PDF for the week (weight trend, training volume, sleep quality, food averages) |
| **Goal setting** | Set a target weight, waist measurement or weekly training sessions. Progress bar and ETA shown on dashboard |
| **Streaks / consistency tracking** | Track how many consecutive days you've logged each module. Shown on dashboard |
| **Import from CSV** | Upload a CSV to bulk-import historical data into any module |
| **Multi-user support** | Right now single-user. Adding a simple user selector (no passwords needed for local use) would support couples / families on the same machine |

### Lower priority / nice to have

| Idea | Description |
|---|---|
| **Dark mode** | Tailwind supports it — mainly cosmetic work |
| **Notification reminders** | Browser notifications to remind you to log weight / sleep at set times |
| **Integration with wearables** | Pull sleep / HRV data from Garmin or Whoop via their APIs (would require API keys and cloud access) |
| **AI-powered insights** | Weekly summary with observations ("your sleep quality correlates with training days", "true weight stable despite scale variation") — could be built as a Claude API integration |

---

## Current Limitations (honest)

- **No authentication** — anyone with access to the machine can see/edit data. Fine for personal use, not suitable for shared/public deployment.
- **SQLite only** — not designed for multiple users writing simultaneously. For personal use this is fine.
- **No automatic backups** — the database is a single file (`prisma/dev.db`). Manual backups are recommended.
- **Measurements preset module label** — a minor bug: the measurements preset picker is currently tagged as `module="training"` internally, meaning measurements presets would appear in the training preset list. Trivial one-line fix.
- **No data validation on date overlaps for food/training** — you can log multiple entries for the same date (by design for food/training, but could cause confusion if logging weight twice on the same day — the second entry doesn't overwrite, it creates a new row).

---

## Running the App

```bash
cd my-pens
npm install           # first time only
npx prisma migrate dev --name init   # first time only (or phase4 if migrating)
npm run dev
```

Then open `http://localhost:3000`

---

*Last updated: March 2026 — Phases 1–4 complete*
