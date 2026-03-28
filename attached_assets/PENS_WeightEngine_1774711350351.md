# PENS — Weight Interpretation Engine

## Purpose
Explain weight fluctuations to users before they have to ask. This is the hero feature of PENS v1. The goal is to replace anxiety with understanding.

## Core Principle
Never show a number without context. Every weight reading gets an interpretation.

---

## Rule-Based Logic (v1 — no ML required)

### Input signals
- Today's weight (from scale)
- Yesterday's weight
- 7-day average weight
- Mode (today + yesterday)
- Context tags (alcohol, heavy meal, travel, late night, intense training)
- Sleep score (from Garmin if available)

### Output
A plain-language explanation card. One sentence max. No jargon.

---

## Interpretation Rules

### Weight UP vs 7-day average

| Condition | Explanation to show |
|-----------|-------------------|
| Heavy meal tag yesterday | "Sodium from yesterday's meal is holding water. Normal." |
| Alcohol tag yesterday | "Alcohol causes water retention. Expect this to clear in 1–2 days." |
| Intense training tag | "Glycogen loading after hard training adds temporary weight. Not fat." |
| Travel tag | "Travel disrupts hydration and digestion. Give it 24–48 hours." |
| Late night tag | "Late eating + less sleep shifts the scale. Not a real trend." |
| Off mode yesterday | "You went Off yesterday. Expect +1–3kg (water + glycogen). Temporary." |
| No tags, no obvious cause | "Small fluctuation. Check your 7-day trend, not today's number." |

### Weight DOWN vs 7-day average
| Condition | Explanation to show |
|-----------|-------------------|
| Post-alcohol (day 2–3) | "Water releasing post-alcohol. This is the rebound, not real loss." |
| Off mode (recovery day) | "Rest is working. Body normalising." |
| Consistent Locked In days | "Trend is real. Keep going." |
| Sudden large drop (>1.5kg) | "Large drops are usually dehydration. Drink water before reading too much into this." |

### Stable weight
| Condition | Explanation |
|-----------|-------------|
| Same as 7-day average ±0.3kg | "Stable. You're maintaining." |
| Balanced mode, stable | "Balanced mode doing its job." |

---

## Phase Gating

### Phase 1 (launch)
- Explanatory only. No predictions.
- Show why the number is what it is today.
- Never show "you'll be X in Y days" — not enough data.

### Phase 2 (after 3–4 weeks user data)
- Add personalised range ("your water retention after alcohol is typically +1.5kg, clears in 2 days")
- Add trend lines
- Add recovery timeline ("based on your history, you stabilise in 3 days after a Off weekend")

---

## Tone Rules
- Never say "you failed" or imply failure
- Never say "you should have…"
- Always frame as temporary when it is temporary
- Be specific about the cause when a tag is present
- Default to calm reassurance when cause is unknown

---

## Edge Cases to Handle

| Situation | Response |
|-----------|----------|
| No scale data for 3+ days | Don't show weight card — skip silently |
| Weight jumps >3kg in 24h | "This is almost certainly a measurement error or hydration spike. Remeasure tomorrow." |
| Consistent upward trend >7 days, no tags | "7-day trend is up without an obvious cause. Worth paying attention to." (neutral, no alarm) |
| User weighs in at night | Flag: "Evening weights run 1–2kg higher than morning. For consistency, weigh in the morning." |

---

## What This Is NOT
- Not a calorie calculator
- Not a fat loss tracker
- Not a judgement system
- Not a prediction engine (until Phase 2)

---

## Build Notes for Replit
All logic in this doc is rule-based. No ML. Inputs: weight, tags, mode, sleep score. Output: one plain-language string. Build as a function: `interpretWeight(todayKg, avgKg, tags[], mode, sleepScore) → string`. Mode values: `"locked_in" | "balanced" | "off"`. Thresholds are soft — calibrate after first user data.
