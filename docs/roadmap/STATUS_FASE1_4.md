# STATUS — roadmap minus dopamine (2026-07-26 late)

Outside dopamine (fase 5). APK: **one shot in the morning** when Jerome provides device IP — not before.

## Done this close-out

| Area | What |
|------|------|
| 2.3 | Body phase on **Prisma UserSettings** + stripeCustomerId column aligned |
| 3 | Continental chrome + Fueling/Train page bodies + energy ledger cards |
| 4 | Signals tests (14) |
| P9 / T8 | **0 T8 warnings** — all date identity via `lib/timeWindow` |

## Still not “acceptatie klaar”

- Device: sleep round-trip, HC sync with HRV
- Mobile Fueling/Train *inner* capture forms (tabs/Read chrome done; food.tsx/training.tsx still module colours)
- **1× APK** after wireless `IP:port`

## Verify

- verify-ship `--skip-apk`: PASS
- smoke-body-phase: OK
- truth-check: PASS (T8 = 0; 7 non-blocking T1 math-in-component warnings)
