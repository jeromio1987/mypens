# My Pens Mobile — Handoff Document

## What Was Built

A React Native / Expo mobile companion app for a Supabase-backed health tracking platform. Six modules accessible via a bottom tab bar, each with a data entry form and a 30-day trend chart.

---

## Environment Secrets Required

These **must** be set as Replit secrets before starting the Expo workflow:

| Secret | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SESSION_SECRET` | Session secret (API server) |

---

## Project Structure

```
artifacts/my-pens-mobile/
├── app/
│   ├── _layout.tsx                  # Root layout: providers, fonts, splash gate
│   └── (tabs)/
│       ├── _layout.tsx              # 6-tab bar (NativeTabs iOS 26 / classic fallback)
│       ├── index.tsx                # Weight module
│       ├── food.tsx                 # Food module
│       ├── sleep.tsx                # Sleep module
│       ├── training.tsx             # Training module
│       ├── measurements.tsx         # Body measurements module
│       └── journal.tsx              # Journal module
├── lib/
│   ├── supabase.ts                  # Lazy Supabase client (Proxy pattern)
│   └── retentionModels.ts           # Weight retention business logic
├── constants/
│   └── colors.ts                    # Light/dark theme + per-module accent colors
├── hooks/
│   └── useColors.ts                 # Color scheme hook (auto dark mode)
├── assets/images/
│   └── icon.png                     # AI-generated app icon
├── app.json                         # Expo config (static — do NOT convert to app.config.ts)
└── package.json                     # Dependencies
```

---

## Modules

### Weight (`app/(tabs)/index.tsx`)
- Scale weight input with ±0.1 kg steppers
- Quick toggles: Morning reading, Hard training
- Expandable **Context** section: creatine dose/days, alcohol units/hours, carbs, high sodium, restaurant meal, flight day, illness
- Expandable **Tanita body comp** section: body fat %, muscle mass, bone mass, body water %, visceral fat
- On submit: calculates `creatineRetentionKg`, `alcoholRetentionKg`, `glycogenRetentionKg`, `trueWeightKg` and inserts to Supabase `WeightEntry` table
- Chart: 30-day dual-line (scale weight vs. true weight) via `react-native-gifted-charts`

### Food (`app/(tabs)/food.tsx`)
- Meal selector: breakfast / lunch / dinner / snack
- Fields: name, kcal, protein (g) — optional detailed: carbs, fat, fiber
- Daily macro progress bars vs. targets (kcal, protein, carbs, fat)
- Targets saved to `AsyncStorage` key `@mypens/food_targets` (no server needed)
- Chart: 14-day calorie bar chart with target reference line
- Per-entry delete

### Sleep (`app/(tabs)/sleep.tsx`)
- Bedtime + wake time inputs (HH:MM format), auto-calculates duration
- Quality: 1–5 star rating
- Optional: HRV (ms), notes
- Uses `upsert` with `onConflict: 'date'` — one entry per day
- Chart: 30-day line (hours + quality overlay)
- Recent 5 entries list

### Training (`app/(tabs)/training.tsx`)
- Exercise autocomplete from history (stored in `AsyncStorage` key `@mypens/recent_exercises`, last 20)
- Set/rep steppers, weight input, live volume preview (sets × reps × kg)
- RPE picker: 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10
- Today's session list with per-entry delete
- Chart: weekly volume bar chart (last 8 weeks)

### Measurements (`app/(tabs)/measurements.tsx`)
- Quick fields: waist, chest, hips
- Detailed toggle adds: left/right arm, left/right thigh, neck
- Uses `upsert` with `onConflict: 'date'` — one entry per day
- Latest stats grid with delta vs. previous entry
- Switchable line chart (waist / chest / hips tabs)

### Journal (`app/(tabs)/journal.tsx`)
- Title (optional) + free-text content
- Mood picker: Rough / Low / Okay / Good / Great (1–5)
- Expandable entry list (tap to expand/collapse content)
- Per-entry delete with confirmation dialog

---

## Supabase Tables

The app expects these tables. All use UUID primary keys and `createdAt` timestamps.

| Table | Key columns |
|---|---|
| `WeightEntry` | `date`, `scaleKg`, `trueWeightKg`, `creatineRetentionKg`, `alcoholRetentionKg`, `glycogenRetentionKg`, `tanitaReliable`, `hardTraining`, `morningReading`, `highSodium`, `restaurantMeal`, `flightDay`, `illnessDay`, `creatineDoseG`, `creatineDaysOn`, `alcoholUnits`, `hoursSinceAlcohol`, `carbsG`, `bodyFatPct?`, `muscleMassKg?`, `boneMassKg?`, `bodyWaterPct?`, `visceralFat?` |
| `FoodEntry` | `date`, `meal` (breakfast/lunch/dinner/snack), `name`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`, `notes?` |
| `SleepEntry` | `date` (unique), `bedtime`, `wakeTime`, `hours`, `quality` (1–5), `hrv?`, `notes?` |
| `TrainingEntry` | `date`, `exercise`, `sets`, `reps`, `weightKg`, `rpe?`, `notes?`, `volume` |
| `BodyMeasurement` | `date` (unique), `waistCm?`, `chestCm?`, `hipsCm?`, `leftArmCm?`, `rightArmCm?`, `leftThighCm?`, `rightThighCm?`, `neckCm?`, `notes?` |
| `JournalEntry` | `date`, `title?`, `content`, `mood?` (1–5), `notes?` |

> **Note:** `JournalEntry` may not exist in the original web app's schema — create it if needed.

---

## Key Libraries

| Package | Purpose |
|---|---|
| `expo-router` v6 | File-based navigation |
| `@supabase/supabase-js` | Database client |
| `@tanstack/react-query` | Server state / caching |
| `react-native-gifted-charts` | LineChart + BarChart |
| `@react-native-async-storage/async-storage` | Local persistence (targets, exercise history) |
| `expo-haptics` | Haptic feedback on form submit |
| `expo-glass-effect` | NativeTabs liquid glass detection |
| `@expo/vector-icons` | Icons (Feather, Ionicons, MaterialCommunityIcons) |

---

## Architecture Notes

### Supabase Client (Lazy Proxy)
`lib/supabase.ts` uses a JavaScript `Proxy` to defer `createClient()` until first use. This avoids the `"Invalid supabaseUrl"` crash that occurs when env vars aren't available at module parse time (which happens in Expo Go if the vars aren't forwarded by the Metro bundler).

**Fix applied:** `package.json` dev script now explicitly forwards:
```
EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Retention Models (`lib/retentionModels.ts`)
Estimates how much of the scale weight is retained water/glycogen, not true fat/muscle change:
- **Creatine:** loading phase (5 days × dose) or maintenance (0.2–0.5 kg)
- **Alcohol:** units × time-decay over 48h (max 1.2 kg)
- **Glycogen:** >200g carbs → 0.3 kg, >300g → 0.5 kg
- **Sodium:** high-sodium flag → 0.2 kg, restaurant flag → 0.15 kg
- **Hard training:** inflammation/glycogen → 0.4 kg
- `trueWeightKg = scaleKg − sum(all retention)`

### Colors
`constants/colors.ts` exports:
- `default colors` — light/dark palette used by `useColors()` hook
- `MODULE_COLORS` — per-module accent colors for cards, charts, and icons

---

## Running Locally

```bash
# Start Expo dev server (via Replit workflow)
# Just press Run, or:
pnpm --filter @workspace/my-pens-mobile run dev

# Type check
pnpm --filter @workspace/my-pens-mobile run typecheck
```

User can scan the QR code from the Replit URL bar menu in **Expo Go** to test on a physical device.

---

## Publishing (iOS)

Replit has a built-in **Expo Launch** flow for App Store submission. Click **Publish** in the Replit UI. Android publishing is not currently supported via Replit.

---

## What's Not in v1

- Offline mode / local-first sync
- Data export (CSV, PDF)
- Presets or food database search
- Push notifications
- Authentication / multi-user (currently uses anon Supabase key)
