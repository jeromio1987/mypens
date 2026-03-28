# PENS — Replit Build Brief

Use this file when briefing Replit. Give Replit the relevant section, not the whole file. Always define inputs, outputs, and logic before asking it to build.

---

## App Overview
PENS is a health interpretation app. Mode-based. Wearables-connected. Minimal input. The system interprets, not the user.

Tech stack decisions: **not yet locked** — confirm with Jerome before starting.

---

## Feature 1: Mode Selection

**What it is:** Daily entry point. User taps one of 5 modes.

**Input:** User tap → one of [locked_in, balanced, off]

**Output:** Mode stored with timestamp. Drives all downstream interpretation.

**Logic:**
- One mode per day (can be changed until midnight)
- Mode persists until changed
- Mode feeds into: weight interpretation, daily card, weekly card

**UI:** 3 large tap targets. Colour-coded (🟢🟡🔴). No other input required. Done in 1 tap.

---

## Feature 2: Context Tags

**What it is:** Optional 1-tap signals. Not logging. Context only.

**Available tags:** alcohol / heavy_meal / travel / late_night / intense_training

**Input:** Multi-select tap (any combination, or none)

**Output:** Tag array stored with date. Used by weight engine and card generator.

**Logic:**
- Tags are optional — no friction if skipped
- Tags apply to the current day
- Tags feed directly into weight interpretation rules

---

## Feature 3: Weight Interpretation Engine

**See PENS_WeightEngine.md for full logic.**

**Function signature:**
```
interpretWeight(todayKg, sevenDayAvgKg, tags[], mode, sleepScore) → string
```

**Returns:** one plain-language sentence explaining the weight reading.

**Phase 1:** rule-based only. No predictions. No ML. Input → rule match → output string.

**Test cases to build against:**
- +2kg after alcohol tag → "Alcohol causes water retention. Expect this to clear in 1–2 days."
- +1.5kg after intense_training tag → "Glycogen loading after hard training adds temporary weight. Not fat."
- stable weight, balanced mode → "Stable. You're maintaining."
- no tags, no clear cause, +0.8kg → "Small fluctuation. Check your 7-day trend, not today's number."

---

## Feature 4: Daily Card Generator

**What it is:** One card per day. Plain-language. Generated from mode + data.

**Function signature:**
```
generateDailyCard(mode, tags[], weightInterpretation, sleepScore, hrvDelta) → {headline, subline, stat}
```

**Returns:** object with headline (string), subline (string), stat (string or null)

**Rules:**
- If data is insufficient (no mode, no wearables, no weight) → return null (no card)
- Never generate a generic placeholder card
- Select template by mode → fill variable slots

**Template example (Off mode):**
```
headline: "Full send. No apologies."
subline: [weightInterpretation if available, else "System is tracking."]
stat: [weight delta vs avg, if available]
```

**Phase 1:** 5–6 fixed templates per mode. No dynamic sentence generation.

---

## Feature 5: Weekly Card Generator

**What it is:** End-of-week narrative summary. Hero format.

**Trigger:** Runs Sunday (or on demand)

**Requires:** Minimum 5 days of data in the week

**Function signature:**
```
generateWeeklyCard(weekData[]) → {headline, modeDistribution, keyInsight, observation}
```

**weekData[] contains per day:** mode, weight, sleepScore, tags

**Returns:**
- headline: narrative string
- modeDistribution: e.g. "3× Balanced / 2× Social / 1× Off / 1× Recovery"
- keyInsight: one-line observation (weight trend, sleep pattern, etc.)
- observation: one honest line — no spin

---

## Wearables Integration

**Priority 1:** Garmin Connect API
- Data needed: sleep duration, sleep score, HRV, steps, HR
- Confirm API access and auth flow before building anything else that depends on it

**Priority 2:** Strava
- Data needed: activity type, duration, distance

**Weight:** manual entry (Phase 1) or Garmin scale sync if available

**Rule:** if wearables data is unavailable, the app still works — just with fewer interpretation inputs. Degrade gracefully, never break.

---

## Data Model (minimal)

```
User
  - id
  - created_at

DayEntry
  - user_id
  - date
  - mode (enum)
  - tags (array)
  - weight_kg (nullable)
  - sleep_score (nullable, from Garmin)
  - hrv (nullable, from Garmin)
  - steps (nullable, from Garmin)

Card
  - user_id
  - date
  - type (daily | weekly)
  - headline
  - subline
  - stat (nullable)
  - generated_at
```

---

## What NOT to build in Phase 1
- Social features of any kind
- Pattern detection / insight engine
- Predictive weight ranges
- Calorie or macro input
- Any ML model
- Notifications (unless trivially simple)

---

## Handoff Protocol
Before building any feature: read the relevant section of PENS_WeightEngine.md or PENS_Clubroom.md. If the logic isn't in those files, go back to Claude before building. Do not invent logic that isn't specified.
