# PENS — Replit Instruction (paste this in full)

## Context
I've reviewed the current build at mypens.replit.app. Good foundation in places, but several things need to change before this is PENS. Below are the exact changes needed. Please do not add features. Only make the changes listed.

---

## CUT — Remove these completely

### 1. Food Log
Delete the Food Log module entirely. Remove it from the home screen, navigation, and any routing. PENS is explicitly not a food logging app. No macros, no meal tracking, no progress bars vs daily targets. This is a core product decision, not a feature toggle.

### 2. Data Health
Delete the Data Health module. A 30-day calendar heatmap of logging streaks rewards obsessive logging behaviour — the opposite of what PENS stands for. Remove it from the home screen and navigation entirely.

### 3. Training module — simplify or remove
The current Training module ("Log exercises, sets, reps, weight, RPE") is too heavy. Options:
- Either remove it entirely for now
- Or reduce it to a single binary: "Did you train today? Yes / No" — stored as a context tag (`intense_training`), not a separate module

Do not build a full exercise logger. That is not PENS.

---

## ADD — Build this as the new entry point

### Mode Selection — home screen
The home screen should open to **mode selection**, not a module list. This is the core mechanic.

3 modes:
- 🟢 **Locked In** — Optimise
- 🟡 **Balanced** — Maintain (covers social/flexible days too)
- 🔴 **Off** — Chaos + recovery (no friction, reset included)

UI requirements:
- 3 large tap targets, full-width, colour-coded
- Mode is stored with a timestamp for that day
- One mode per day — can be changed until midnight
- After selecting a mode, user sees: context tags + today's Clubroom card (if available)
- Mode drives all downstream logic: weight interpretation, daily card, weekly card

Context tags (shown after mode selection, all optional):
- Alcohol
- Heavy meal
- Travel
- Late night
- Intense training

---

## FIX — Change these in existing modules

### Weight Tracker — simplify the default view
The detailed entry form (body fat %, muscle mass, bone mass, body water %, visceral fat) should be hidden by default. It already has a Quick/Detailed toggle — make Quick the default. Quick = scale weight + date only. Detailed = everything else (for Tanita users).

### Clubroom — fix the tone
Remove or replace these messages:
- ❌ "Log more consistently to unlock meaningful interpretation" → remove
- ❌ "Keep logging" → remove
- ❌ Any message that implies the user failed or should do more

When there is no data, the Clubroom should say something neutral:
- ✅ "Nothing to report yet. Check back Sunday."
- ✅ "A quiet week. That's fine."
- ✅ "No data this week — the system is ready when you are."

The Clubroom never pressures. It observes and interprets. It does not nag.

---

## KEEP — Do not change these

- The Clubroom structure (Weekly wrap / Report to Self / medals) — keep as-is, just fix the tone
- The Weight Tracker "true weight vs scale" logic — this is the hero feature, keep it
- The Sleep module — keep it, it feeds into the interpretation engine
- The "PRIVATE · V1" label in the Clubroom — keep it
- The dark theme in the Clubroom — keep it
- The Context tab in Weight Tracker — keep it
- Event Tags — keep it but move it to be integrated into mode selection (as context tags), not a separate module

---

## Priority order

1. Add mode selection as the new home screen entry point
2. Remove Food Log
3. Remove Data Health
4. Fix Clubroom tone
5. Simplify Weight Tracker default view
6. Simplify or remove Training module

Do these in order. Do not start new features until these are done.
