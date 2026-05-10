# My Pens Mobile

A React Native / Expo health tracking companion app with 6 modules: Weight, Food, Sleep, Training, Measurements, and Journal. Backed by Supabase (PostgreSQL).

## Run & Operate

- `pnpm --filter @workspace/my-pens-mobile run dev` — Expo dev server (via workflow)
- `pnpm --filter @workspace/api-server run dev` — Express API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Stack

- Expo SDK 54, expo-router v6, React Native 0.81
- Supabase (PostgreSQL) for all data persistence
- @tanstack/react-query for server state
- react-native-gifted-charts for trend charts
- Inter font (400/500/600/700)
- NativeTabs (iOS 26 liquid glass) + classic Tabs fallback

## Where things live

- `artifacts/my-pens-mobile/` — Expo mobile app
  - `app/(tabs)/` — 6 module screens (index=Weight, food, sleep, training, measurements, journal)
  - `lib/supabase.ts` — lazy Supabase client (proxy pattern to avoid init-time crash)
  - `lib/retentionModels.ts` — weight retention business logic (creatine, alcohol, glycogen, sodium, training)
  - `constants/colors.ts` — light/dark theme + per-module accent colors
  - `hooks/useColors.ts` — color scheme hook
- `artifacts/api-server/` — Express API server (healthz only in v1)

## Supabase tables used

- `WeightEntry` — scale weight + confounders + computed trueWeightKg
- `FoodEntry` — meals with macros (kcal, protein, carbs, fat, fiber)
- `SleepEntry` — bedtime, wakeTime, hours, quality, HRV
- `TrainingEntry` — exercise, sets, reps, weightKg, RPE, volume
- `BodyMeasurement` — waist, chest, hips, arms, thighs, neck
- `JournalEntry` — title, content, mood (1–5)

## Architecture decisions

- Supabase client uses a Proxy for lazy initialization — avoids "invalid supabaseUrl" crash when env vars aren't available at module parse time
- Food daily targets stored in AsyncStorage (`@mypens/food_targets`) — no server round-trip needed
- Recent exercises stored in AsyncStorage (`@mypens/recent_exercises`) — autocomplete in Training tab
- Sleep entries use `upsert` with `onConflict: 'date'` — one entry per day
- Measurements use `upsert` with `onConflict: 'date'` — one entry per day

## Product

A mobile health companion for logging: body weight (with retention model to estimate true weight), food intake with macro tracking, sleep quality, gym training sets, body measurements, and daily journal entries. Each module shows a 30-day trend chart using react-native-gifted-charts.

## User preferences

_Populate as you build._

## Gotchas

- `EXPO_PUBLIC_*` secrets must be set before the Expo workflow starts — they are bundled at build time by Metro
- Do not rename Supabase table names — they're referenced by string in all queries
- `react-native-gifted-charts` requires `react-native-svg` (already installed)
