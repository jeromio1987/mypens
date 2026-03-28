# MY PENS — Mobile App Specification
**Handoff document for React Native / Expo build**

---

## Goal

Build a native iOS/Android companion app to the existing MY PENS web app. The mobile app must:
- Work offline when travelling (no dependency on a home WiFi connection)
- Share the same data as the web app (cloud database)
- Cover all 5 modules: Weight, Food, Sleep, Training, Measurements
- Be fast to use — daily logging in under 30 seconds per module

---

## Recommended Architecture

### Frontend
**Expo (React Native)** — managed workflow, TypeScript, same component/hook patterns as the web app. Target: iOS and Android.

### Backend / Database
**Supabase** — hosted PostgreSQL. Free tier covers personal use easily.

Why Supabase over alternatives:
- The existing Prisma schema migrates with a one-line change (see migration section below)
- The web app keeps working — just points to Supabase instead of local SQLite
- Supabase has a JavaScript/TypeScript SDK (`@supabase/supabase-js`) that works natively in Expo
- Row-level security is available if you later add auth
- Free tier: 500MB database, 1GB file storage, 50,000 active users/month

### Authentication (optional but recommended)
Supabase Auth with Magic Link (email) or just a single shared anonymous session for personal use. No password required.

---

## Step 1 — Migrate the Web App to Supabase

This must happen before building the mobile app, so both share the same data.

### 1a. Create a Supabase project
1. Go to https://supabase.com → New project
2. Note down: `Project URL`, `anon public key`, `service role key`, `DB connection string`

### 1b. Update `prisma/schema.prisma`

Change **one line** only:

```diff
datasource db {
-  provider = "sqlite"
-  url      = "file:./dev.db"
+  provider = "postgresql"
+  url      = env("DATABASE_URL")
}
```

### 1c. Add environment variable

Create `.env.local` in the web app root:
```
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```
(Get this from Supabase Dashboard → Settings → Database → Connection string → URI)

### 1d. Run migration

```bash
npx prisma migrate dev --name init
```

This creates all tables in Supabase. Your existing data in `dev.db` is not migrated automatically — export it to CSV from the web app first if you want to keep it.

### 1e. Migrate existing data (optional)

The web app has a CSV export built into the Dashboard. Export each module, then write a one-off import script or use the Supabase table editor to paste the data in.

---

## Step 2 — Build the Expo App

### Scaffold

```bash
npx create-expo-app my-pens-mobile --template blank-typescript
cd my-pens-mobile
```

### Key dependencies

```bash
npx expo install expo-router @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install react-native-gifted-charts  # or victory-native for charts
npx expo install expo-secure-store           # for storing Supabase keys safely
npx expo install @expo/vector-icons          # icons
```

### Folder structure (recommended)

```
app/
  (tabs)/
    index.tsx          → Dashboard (home tab)
    weight.tsx         → Weight tracker
    food.tsx           → Food log
    sleep.tsx          → Sleep
    training.tsx       → Training log
    measurements.tsx   → Body measurements
  _layout.tsx          → Bottom tab navigator
lib/
  supabase.ts          → Supabase client init
  retentionModels.ts   → Copy from web app (pure TS, no deps)
  foodModels.ts        → Copy from web app (pure TS, no deps)
components/
  weight/
  food/
  sleep/
  training/
  measurements/
  shared/
```

### Supabase client (`lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://[YOUR-PROJECT-REF].supabase.co'
const SUPABASE_ANON_KEY = '[YOUR-ANON-KEY]'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

---

## Step 3 — Screen-by-Screen Spec

The mobile app replicates the web app's functionality. No new features are needed for v1.

### Navigation
**Bottom tab bar** with 5 tabs + 1 home:

| Tab | Icon | Route |
|---|---|---|
| Home | grid | Dashboard summary |
| Weight | scale | Weight entry + trend |
| Food | fork | Food log |
| Sleep | moon | Sleep log |
| Train | dumbbell | Training log |
| Body | ruler | Measurements |

### Dashboard (Home tab)
Show today's summary cards for each module:
- Weight: latest true weight + trend arrow
- Food: today's kcal logged vs target
- Sleep: last night's hours + quality
- Training: today's session volume (or "Rest day")
- Measurements: latest waist (or days since last measurement)

No charts on the dashboard — just key numbers. Charts are on each module's own tab.

### Weight Tab

**Entry form (top half):**
- Scale weight (large number input)
- Quick toggle to show/hide context inputs
- Context: creatine dose, days on, alcohol units, hours since, carbs g, hard training (toggle), morning reading (toggle)
- Phase 5 confounders: high sodium, restaurant meal, flight day, illness day (all toggles)
- Tanita section: body fat %, muscle mass, bone mass, body water %, visceral fat

**Trend (bottom half):**
- 30-day line chart: scale vs true weight
- Body comp chart: body fat % + muscle mass (if data exists)

### Food Tab

**Header:** Date picker + daily targets summary bar (kcal / P / C / F vs targets)

**Entry form:**
- Meal type picker (Breakfast / Lunch / Dinner / Snack)
- Food name
- Quick mode: kcal + protein only
- Detailed mode: + carbs, fat, fiber, notes

**Log below form:**
- Items grouped by meal type
- Swipe left to delete

**Settings (gear icon):**
- Set daily targets for kcal, protein, carbs, fat
- Stored in AsyncStorage (same pattern as web app's localStorage)

### Sleep Tab

**Entry form:**
- Bedtime picker (time wheel)
- Wake time picker (time wheel)
- Calculated duration shown automatically
- Quality: 1–5 star picker
- Optional: HRV field, notes

**Trend:**
- 30-day chart: sleep duration bars + quality line overlay

### Training Tab

**Entry form:**
- Exercise name (text input with autocomplete from recent exercises)
- Sets, reps, weight (kg)
- Live volume preview: sets × reps × weight
- RPE (optional slider 1–10)
- Notes (optional)

**Session log below:**
- Today's exercises in order
- Swipe left to delete

**Trend:**
- Weekly volume bar chart (last 8 weeks)

### Measurements Tab

**Entry form:**
- Date
- Quick mode: waist, chest, hips only
- Detailed mode: + arms, thighs, neck

**Trend:**
- Line chart with toggle per body part (waist default on)
- Latest values with delta vs previous

---

## Data Access Pattern (Supabase in Expo)

Replace Next.js API routes with direct Supabase queries. The tables are identical.

**Example — fetch weight entries:**
```typescript
const { data, error } = await supabase
  .from('WeightEntry')
  .select('*')
  .order('date', { ascending: false })
  .limit(30)
```

**Example — insert weight entry:**
```typescript
const breakdown = calculateWeightBreakdown(formValues)  // same function from web app

const { data, error } = await supabase
  .from('WeightEntry')
  .insert({
    date: form.date,
    scaleKg: form.scaleKg,
    // ... all fields
    trueWeightKg: breakdown.trueWeightKg,
    tanitaReliable: breakdown.tanitaReliable,
  })
```

**Example — delete:**
```typescript
await supabase.from('FoodEntry').delete().eq('id', id)
```

### Business logic reuse

Copy these files from the web app verbatim — they have zero React/Next.js dependencies:
- `lib/retentionModels.ts` → all weight retention calculations (v3)
- `lib/foodModels.ts` → macro summation, targets, meal constants

**v3 `retentionModels.ts` exports to be aware of:**

| Export | Purpose |
|---|---|
| `calculateWeightBreakdown(input)` | Core: strips creatine / alcohol / glycogen / sodium / hardTraining retention. Returns `sodiumKg` and `hardTrainingKg` as separate fields — these are computed from flags, not stored in the DB. |
| `calculateRollingBaseline(history)` | EWMA of last 7 true-weight entries. Returns `null` until ≥ 3 entries exist. |
| `calculateDynamicBand(history, fallbackConf)` | Volatility-based uncertainty band. Falls back to static rule until ≥ 5 entries exist. |
| `detectOutlier(scaleKg, baseline, bandKg)` | Returns `true` when scale diverges > 2.5× band from baseline. |

**Mobile implementation note:** In the web app, the rolling baseline and outlier enrichment runs in the Next.js GET route (`app/api/weight/route.ts`). In the mobile app with Supabase direct queries, you must run this enrichment client-side after fetching entries:

```typescript
import {
  calculateConfidence,
  calculateRollingBaseline,
  calculateDynamicBand,
  detectOutlier,
  estimateSodiumRetention,
  estimateHardTrainingRetention,
} from '@/lib/retentionModels'
import type { HistoryEntry } from '@/lib/retentionModels'

// After fetching entries sorted ascending:
const history: HistoryEntry[] = []
const enriched = entries.map(e => {
  const sodiumKg       = estimateSodiumRetention(e.highSodium, e.restaurantMeal)
  const hardTrainingKg = estimateHardTrainingRetention(e.hardTraining)
  const trueWeightKg   = parseFloat(
    (e.scaleKg - e.creatineRetentionKg - e.alcoholRetentionKg - e.glycogenRetentionKg - sodiumKg - hardTrainingKg).toFixed(2)
  )
  const confidence = calculateConfidence({ ...e }).level
  const baselineTrendKg = calculateRollingBaseline(history)
  const { bandKg: dynamicBandKg, source } = calculateDynamicBand(history, confidence)
  const isOutlier = detectOutlier(e.scaleKg, baselineTrendKg, dynamicBandKg)

  history.push({ date: e.date, trueWeightKg, confidence })

  return { ...e, trueWeightKg, sodiumKg, hardTrainingKg, confidence, baselineTrendKg, dynamicBandKg, dynamicBandSource: source, isOutlier }
})
```

---

## Offline Support (Phase 2 of mobile — not v1)

For v1, require internet connection. Offline is a significant additional scope:
- Would need a local SQLite cache on the phone (via `expo-sqlite`)
- Sync logic on reconnect (conflict resolution needed)
- Not recommended until v1 is stable

---

## Database Schema Reference

All table and column names to use in Supabase queries. These are created by Prisma migrate from the schema.

### WeightEntry
```
id, createdAt, date, scaleKg,
bodyFatPct?, muscleMassKg?, boneMassKg?, bodyWaterPct?, visceralFat?,
creatineDoseG, creatineDaysOn, alcoholUnits, hoursSinceAlcohol, carbsG,
hardTraining, morningReading,
highSodium, restaurantMeal, flightDay, illnessDay,
creatineRetentionKg, alcoholRetentionKg, glycogenRetentionKg,
trueWeightKg, tanitaReliable

Not stored (computed on the fly from flags):
  sodiumKg        — from highSodium / restaurantMeal
  hardTrainingKg  — from hardTraining
  confidence      — from all retention values + flags
  baselineTrendKg — EWMA of prior entries
  dynamicBandKg   — volatility-based uncertainty
  isOutlier       — scale vs baseline deviation flag
```

### FoodEntry
```
id, createdAt, date, meal (breakfast|lunch|dinner|snack),
name, kcal, proteinG, carbsG, fatG, fiberG, notes?
```

### SleepEntry
```
id, createdAt, date (unique), bedtime, wakeTime, hours, quality (1-5), hrv?, notes?
```

### TrainingEntry
```
id, createdAt, date, exercise, sets, reps, weightKg, rpe?, notes?, volume
```

### BodyMeasurement
```
id, createdAt, date (unique),
waistCm?, chestCm?, hipsCm?,
leftArmCm?, rightArmCm?, leftThighCm?, rightThighCm?, neckCm?,
notes?
```

### Preset
```
id, createdAt, module (weight|food|sleep|training|measurements), name, data (JSON string), usedCount
```

---

## UI Style Reference

Keep the same visual language as the web app for consistency:

| Element | Web app | Mobile equivalent |
|---|---|---|
| Background | `bg-gray-50` | `#f9fafb` |
| Cards | white, `rounded-2xl`, `shadow` | white, border-radius 16, shadow |
| Primary blue | `bg-blue-600` | `#2563eb` |
| Weight accent | `bg-blue-600` | `#2563eb` |
| Food accent | `bg-violet-600` | `#7c3aed` |
| Sleep accent | `bg-violet-500` | `#8b5cf6` |
| Training accent | `bg-orange-500` | `#f97316` |
| Measurements accent | `bg-rose-600` | `#e11d48` |
| Body text | `text-gray-900` | `#111827` |
| Muted text | `text-gray-400` | `#9ca3af` |
| Font | System (Geist on web) | System default (SF Pro / Roboto) |

---

## What NOT to Build in v1

Keep scope tight. Exclude from first release:
- Offline mode (complex sync logic)
- Backup / export (use web app for that)
- Dashboard charts (just numbers on mobile dashboard)
- Presets UI (can add in v2)
- Settings screen beyond macro targets

---

## Suggested Build Order

1. Scaffold Expo app + routing + bottom tabs
2. Supabase client connection + verify queries work
3. Weight entry + weight trend chart
4. Food entry + daily macro bars
5. Sleep entry + sleep chart
6. Training entry + session log
7. Measurements entry
8. Dashboard home screen (numbers only)
9. Macro targets settings (AsyncStorage)
10. Polish: loading states, error handling, empty states

---

*Last updated: March 2026. Reflects web app v3 weight model (rolling baseline, dynamic band, outlier detection, quantified sodium + training retention). All referenced table names and field names match the live Prisma schema.*
