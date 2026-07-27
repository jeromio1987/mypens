---
name: mypens-verify-ship
description: >-
  Post-ship verification for myPENS / mypens-mobile. Runs mobile tsc, scoped web
  typecheck, API smoke probes, and APK-embed rebuild gate. Use after every
  myPENS ship, mobile UI change, food/weight/energy/training/HC edit, or when
  Jerome asks to verify before claiming done.
---

# myPENS — verify ship

**Ship agent may not say done until verify PASS.**

Run this skill **after every myPENS ship** (mobile or web paths that touch food,
weight, energy, training, Health Connect, tabs, or API). Do not claim “shipped”,
“fixed on device”, or “done” on a FAIL report.

## One-shot

From any shell (prefer repo root `Projects/mypens`):

```powershell
node .cursor/skills/mypens-verify-ship/scripts/verify-ship.mjs
```

When Cursor workspace is ISZE (skill mirrored there):

```powershell
node .cursor/skills/mypens-verify-ship/scripts/verify-ship.mjs --mypens-root "C:\Users\jerom\Desktop\claude\Projects\mypens"
```

Optional flags:

| Flag | Meaning |
|------|---------|
| `--skip-apk` | Jerome explicitly skipped APK rebuild this session |
| `--apk-rebuilt` | Mark APK/JS embed rebuild+install done this session |
| `--date YYYY-MM-DD` | Smoke date (default: today local) |
| `--report PATH` | Write `VERIFY_REPORT.md` (default: `mypens-mobile/docs/VERIFY_REPORT.md`) |

## Gates (all required)

### 1. Mobile TypeScript — must be green

```powershell
cd mypens-mobile
npx tsc --noEmit
```

Any error → **FAIL**.

### 2. Web TypeScript — scoped or allowlisted

Prefer scoped check on touched files. Full `npx tsc --noEmit` in mypens root is
allowed to have **pre-existing** errors only under:

- `clubroom/`
- `garmin` paths
- `stripe` paths
- `FoodEntry` legacy paths documented in the script allowlist

**FAIL** on any **new** error whose path matches critical lanes:

- `app/api/food`, `lib/food`, `components/food`
- `app/api/energy-balance`, `lib/energyBalance`
- `app/api/weight`, weight / measurements
- `app/api/period-review`, training / HC / mobile API auth
- `mypens-mobile/app`, `mypens-mobile/components`, `mypens-mobile/lib` (also covered by gate 1)

### 3. API smoke (local Next)

If Next is up (default `EXPO_PUBLIC_PENS_API_URL` or `http://127.0.0.1:5000`):

1. `GET /api/health` — must return quickly (`ok`)
2. With `MOBILE_PENS_API_TOKEN` / `EXPO_PUBLIC_PENS_API_TOKEN`:
   - `GET /api/food?date=<today>`
   - `GET /api/energy-balance?date=<known-date>`

Auth: `Authorization: Bearer <token>`.

If API is down / health times out → mark smoke **SKIP** (not PASS). Do not invent PASS.
Hung listener (port open, no response) → **FAIL** smoke with “API wedged”.

### 4. APK / JS embed gate

`mypens-mobile/android/app/build.gradle` uses `debuggableVariants = []` → JS is
**embedded**. Any mobile UI change this session requires rebuild + `adb install -r`
(keep HC grants).

- Mobile UI changed **and** neither `--apk-rebuilt` nor session stamp
  `mypens-mobile/docs/.verify_apk_rebuilt` → **FAIL** “ship complete” narrative
- Jerome said skip → pass `--skip-apk` (report notes SKIP)

Stamp after install:

```powershell
New-Item -Force mypens-mobile/docs/.verify_apk_rebuilt | Out-Null
```

## Output — VERIFY_REPORT

Script prints and writes a short report:

```markdown
# VERIFY_REPORT — myPENS ship
Status: PASS | FAIL

- mobile_tsc: PASS|FAIL
- web_tsc: PASS|FAIL|SKIP (detail)
- api_smoke: PASS|FAIL|SKIP (detail)
- apk_embed: PASS|FAIL|SKIP (detail)

## Notes
- …
```

## Agent checklist

Copy and tick before saying done:

```
- [ ] Ran verify-ship.mjs
- [ ] Status PASS (or Jerome waived a specific SKIP in writing)
- [ ] If mobile UI changed: APK rebuilt + adb install -r (or --skip-apk)
- [ ] Pasted VERIFY_REPORT bullets in the reply
```

## Stop hook

Project stop hook runs mobile `tsc` when mypens paths are dirty and follow-ups
loudly on failure. Still run the full skill before claiming ship done.
