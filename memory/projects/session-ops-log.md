# Session ops log — Jerom ↔ Cursor (improve both)

Append-only. Goal: fewer repeated failures, clearer handoffs.

## How we use this
- After friction: add a short entry (date · what broke · fix · rule).
- Agent: read before giving Windows/Expo/path commands.
- Jerom: when something fails, paste the **exact** terminal cwd + error (not only “nothing happened”).

---

## 2026-07-23 — recurring friction

### Paths
| Wrong | Right |
|-------|--------|
| `C:\Users\jerom` (home) | Project folders under Desktop |
| `mypens-feedback-test` for Expo | `C:\Users\jerom\Desktop\claude\Projects\mypens\mypens-mobile` |
| Placeholder `<whatever-path>` typed literally | Real path only |
| Assumed sibling `Projects\mypens-mobile` | Actual: `Projects\mypens\mypens-mobile` (also `Desktop\claude\mypens\mypens-mobile`) |

**Rule:** Always lead with `cd /d <full path>` then `dir package.json` / `dir app.json` before npm/expo.

### Ports
| Symptom | Meaning | Action |
|---------|---------|--------|
| `EADDRINUSE :5000` | Next already running | Use it; don’t start a second. Kill only if restart needed |
| `taskkill` on :8081 with no output | Nothing listening — OK | Proceed to `npx expo start --clear` |
| Phone Metro 404 / doubled `Projects\mypens\mypens-mobile\...` | Stale Expo Go URL or wrong cwd | `cd` mobile folder → `npx expo start --clear` → close old project on phone → new QR; Tunnel if LAN fails |

**Rule:** Next = **5000** (API). Expo = **8081** (UI). Phone Food → `EXPO_PUBLIC_PENS_API_URL=http://<LAN-IP>:5000`.

### Env / DB
| Symptom | Cause | Fix |
|---------|--------|-----|
| Cockpit all zeros | Bad/duplicate `DATABASE_URL` (last `YOUR_PASSWORD` wins) | One valid `postgresql://…` pair; password `?` → `%3F` |
| SQL Editor has data, app empty | Local `.env` ≠ that Supabase | Align URL to project `eiyyblruwqqfrdroerhk` |
| Empty HRV/stress charts | Nested Garmin fields not imported | Re-import after nested fix; not a date-zoom bug |
| Zoom past ledger end | `to=today` while data ends earlier | Auto-clamp to ledger max |

### Product lessons
- Offline HTML report ≠ live `/period-review`.
- Training minutes ≠ load → PLU (sport × HR).
- Food: photo + OFF typeahead + grams scaler; no private Delhaize DB.
- Instant planner needs recent DB rows; “almost live” = morning sync, not second-by-second.

### Collaboration rules (improve both)
1. **Exact cwd every time** — never assume user is in the project folder.
2. **Two terminals** — (A) Next 5000 (B) Expo 8081; say which.
3. **EADDRINUSE** → first say “already running, use it” before kill commands.
4. **Empty command output** → explain “no match = success/nothing to kill”.
5. Prefer http://localhost:5000/food for PC food; Expo QR only when phone needed.
6. Don’t invent paths; give 2–3 candidates from prior `dir` hits.
7. Secrets: don’t ask to paste `.env` into chat; guide edits locally.

---

## Next append
_When something fails again, add: date · command · cwd · error one-liner · what we change in the rules above._
