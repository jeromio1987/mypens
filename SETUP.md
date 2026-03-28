# MY PENS — Setup Guide (Phase 1 + Phase 2 + Phase 3)

## Prerequisites
- Node.js v20+ → https://nodejs.org (download LTS)
- Verify: `node --version`

---

## Step 1 — Create the Next.js project

```bash
npx create-next-app@latest my-pens
```

Answer the prompts:
- TypeScript? → **Yes**
- ESLint? → **Yes**
- Tailwind? → **Yes**
- src/ directory? → **No**
- App Router? → **Yes**
- Import alias? → **No**

```bash
cd my-pens
```

---

## Step 2 — Install dependencies

```bash
npm install @prisma/client prisma lucide-react recharts
npx prisma init --datasource-provider sqlite
```

---

## Step 3 — Copy files from this folder

Copy every file from this `my-pens/` folder into your project root, preserving folder structure:

```
prisma/schema.prisma             ← replaces the default
lib/db.ts
lib/retentionModels.ts
lib/foodModels.ts
app/page.tsx                     ← home with all 4 modules
app/weight/page.tsx
app/food/page.tsx
app/sleep/page.tsx               ← Phase 3
app/training/page.tsx            ← Phase 3
app/api/weight/route.ts
app/api/food/route.ts
app/api/sleep/route.ts           ← Phase 3
app/api/training/route.ts        ← Phase 3
components/weight/WeightEntry.tsx
components/weight/WeightTrend.tsx
components/food/FoodEntry.tsx
components/food/FoodLog.tsx
components/sleep/SleepEntry.tsx  ← Phase 3
components/sleep/SleepTrend.tsx  ← Phase 3
components/training/TrainingEntry.tsx  ← Phase 3
components/training/TrainingLog.tsx    ← Phase 3
```

---

## Step 4 — Initialise the database

**Fresh install:**
```bash
npx prisma generate
npx prisma db push
```

**Existing install (Phase 1/2 already running) — migrate the new tables:**
```bash
npx prisma generate
npx prisma db push
```
The same command is safe to re-run — it only adds the new `SleepEntry` and `TrainingEntry` tables without touching existing data.

---

## Step 5 — Run

```bash
npm run dev
```

Open: http://localhost:3000

---

## What you get

### Phase 1 — Weight Tracker (`/weight`)
- 3-tab entry form: Scale readings · Context (creatine/alcohol/carbs) · Tanita flags
- Automatic water retention calculation on save
- True weight = scale − (creatine + alcohol + glycogen retention)
- Tanita BIA reliability warning when conditions are off
- 30-day trend chart: scale vs true weight vs retention
- Entry history list

### Phase 2 — Food Log (`/food`)
- Meal-type selector: breakfast / lunch / dinner / snack
- Per-item macro entry: kcal, protein, carbs, fat, fiber
- Daily macro progress bars vs default targets (2200 kcal / 160g P / 220g C / 70g F)
- Entries grouped by meal with delete
- Date picker to review past days

### Phase 3 — Sleep (`/sleep`)
- Log bedtime + wake time; hours auto-calculated (handles midnight crossing)
- Quality rating 1–5 with emoji labels
- Optional HRV (ms) and free-text notes
- One entry per day (upsert — re-logging the same date overwrites)
- 30-day chart: bar height = duration, bar colour = quality, amber line = quality score
- History list with hover-delete

### Phase 3 — Training (`/training`)
- Log exercise name, sets, reps, weight (kg), RPE (1–10), notes
- Volume auto-calculated on save: sets × reps × weightKg
- Bodyweight exercises (weight = 0) are supported
- Today's session view with per-exercise breakdown and total volume
- Weekly volume bar chart (last 8 weeks, current week highlighted)
- Recent session history grouped by date
- Hover-to-delete on today's entries

---

## Changing daily macro targets

Edit `lib/foodModels.ts` → `DEFAULT_TARGETS`:

```ts
export const DEFAULT_TARGETS: DailyTargets = {
  kcal: 2200,
  proteinG: 160,
  carbsG: 220,
  fatG: 70,
}
```

---

## Phase 4 ideas (next session)
- Dashboard: weekly summary card combining all four modules
- Export to CSV (per module or combined)
- Body measurements log (waist, chest, hips)
- Workout templates / programme builder
