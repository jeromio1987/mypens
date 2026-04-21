# My Pens — Mobile Companion Stubs

These are minimal sample apps that show how to read workouts from
**Apple HealthKit** (iOS) and **Android Health Connect**, and push them to the
My Pens web backend.

They are intentionally tiny — no UI polish, no background scheduling, no
retry/queue logic. Treat them as a starting point that you can drop into a
fresh Xcode / Android Studio project.

```
mobile-companions/
├── ios/HealthKitCompanion/      # SwiftUI single-screen app
└── android/HealthConnectCompanion/   # Kotlin single-screen app
```

## 1. Get a pairing token

1. Open the My Pens web app.
2. Go to `/integrations`.
3. Pair either **Apple Health** or **Health Connect** — the page issues a
   one-off bearer token. Copy it.

## 2. Configure the sample

Both samples store the token + base URL in app preferences (`UserDefaults` on
iOS, `SharedPreferences` on Android). On first launch, paste:

- **Base URL** — the public URL of your My Pens deployment, e.g.
  `https://my-pens.example.com` (no trailing slash).
- **Pairing token** — the value copied above.

Then tap **Sync now**. The app:

1. Asks the OS for read permission on workout / exercise sessions.
2. Reads sessions newer than the last successful sync timestamp (also stored
   in preferences). On first run it pulls the last 30 days.
3. POSTs them to:
   - iOS → `POST {baseUrl}/api/integrations/healthkit/ingest`
     with body `{ "workouts": HealthkitWorkout[] }`
   - Android → `POST {baseUrl}/api/integrations/healthconnect/ingest`
     with body `{ "sessions": HealthConnectExerciseSession[] }`
4. On HTTP 200 (`{ ok: true, stored, skipped }`), advances the
   "last sync" cursor.

Both endpoints are idempotent on `externalId` (HealthKit `uuid` /
Health Connect record `id`), so re-running a sync is safe — duplicates land in
`skipped`.

## 3. Payload shapes

These must match the TypeScript interfaces in
`lib/integrations/healthkit/api.ts` and
`lib/integrations/healthconnect/api.ts`. The samples already build the JSON
exactly as expected; if you change the server-side shapes, update the
`encode…` helpers in the sample apps too.

### HealthKit (`HealthkitWorkout`)

| Field                | Source on iOS                                 |
| -------------------- | --------------------------------------------- |
| `uuid`               | `HKWorkout.uuid.uuidString`                   |
| `workoutActivityType`| camelCased `HKWorkoutActivityType` name       |
| `startDate`          | ISO8601 of `HKWorkout.startDate`              |
| `endDate`            | ISO8601 of `HKWorkout.endDate`                |
| `durationSec`        | `HKWorkout.duration`                          |
| `totalDistanceM`     | `totalDistance` in meters (if any)            |
| `totalEnergyKcal`    | `totalEnergyBurned` in kcal (if any)          |
| `averageHeartRate`   | optional — sample leaves it unset             |
| `sourceName`         | `HKWorkout.sourceRevision.source.name`        |
| `notes`              | optional — sample leaves it unset             |

### Health Connect (`HealthConnectExerciseSession`)

| Field             | Source on Android                                |
| ----------------- | ------------------------------------------------ |
| `id`              | `ExerciseSessionRecord.metadata.id`              |
| `exerciseType`    | `EXERCISE_TYPE_INT_TO_STRING_MAP` lookup         |
| `title`           | `ExerciseSessionRecord.title`                    |
| `startTime`       | ISO8601 of `startTime` w/ `startZoneOffset`      |
| `endTime`         | ISO8601 of `endTime`   w/ `endZoneOffset`        |
| `durationSec`     | `endTime - startTime` in seconds                 |
| `totalDistanceM`  | optional — fetched separately from `DistanceRecord` if needed |
| `totalEnergyKcal` | optional — same as above for `TotalCaloriesBurnedRecord` |
| `averageHeartRate`| optional                                         |
| `packageName`     | `metadata.dataOrigin.packageName`                |
| `notes`           | optional                                         |

The minimal samples send the required fields plus what HealthKit /
Health Connect hand back on the session record itself; richer aggregates
(distance, calories, HR) are left as exercises for whoever turns this into a
real app.

## 4. Building

### iOS

1. In Xcode: **File → New → Project → App** (SwiftUI, Swift).
2. Replace `ContentView.swift` with `ios/HealthKitCompanion/ContentView.swift`
   and add `HealthKitClient.swift` next to it.
3. Add the **HealthKit** capability under *Signing & Capabilities*.
4. In `Info.plist`, add:
   - `NSHealthShareUsageDescription` — "Read workouts to sync with My Pens."
5. Run on a real device (HealthKit doesn't return data in the simulator).

### Android

1. In Android Studio: **New → New Project → Empty Activity** (Kotlin, min SDK
   26+; Health Connect needs API 28 in practice, target 34).
2. Drop `android/HealthConnectCompanion/MainActivity.kt` into your
   `com.example.healthconnectcompanion` package.
3. Replace `app/build.gradle.kts` deps with the snippet at the top of
   `MainActivity.kt`, and `AndroidManifest.xml` with the snippet inside
   `android/HealthConnectCompanion/AndroidManifest.xml`.
4. Install the **Health Connect** app from the Play Store on the test device.
5. Run on a real device.

## 5. Limitations

- No background sync — user has to open the app and tap **Sync now**.
- No retry queue — failed POSTs are simply re-attempted on the next sync.
- No conflict UI — promote / discard happens server-side in `/integrations`.
- Heart-rate, distance and calorie aggregates that aren't on the workout
  record itself are not fetched. Add `HKStatisticsQuery` (iOS) /
  `aggregate(...)` (Android) calls if you need them.
