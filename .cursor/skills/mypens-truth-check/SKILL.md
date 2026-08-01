# myPENS truth-check (WP 0.8)

Runs beside `mypens-verify-ship`. Hard-fails on T8 (date identity outside `timeWindow`) and T2/T3 coverage/empty-state gates. T1 is warning-only until the allowlist is curated.

```bash
node .cursor/skills/mypens-truth-check/scripts/truth-check.mjs
```

| # | Gate | Severity |
|---|---|---|
| T1 | Engine-like math in components (S3: narrowed) | warning |
| T2 | Score without coverage | fail |
| T3 | Missing empty state | fail |
| T8 | Date identity outside `lib/timeWindow.*` | fail |

## Grep targets follow implementation, not wrappers

After WP 2.2, thin route/page wrappers no longer hold the gated logic. Checks that only open wrappers produce **false FAIL on correct code** (Audit 3 H1).

| Gate | Grep here (owner) | Do not treat as sole owner |
|---|---|---|
| T2 | `lib/verdictData.ts` (`hasDataP`, `PILLAR_COVERAGE_MIN`, `scoreP = hasDataP ?`) | `app/api/verdict/route.ts` (calls `computeVerdictData`) |
| T3 (web verdict) | `app/verdict/VerdictClient.tsx` (empty-state markers) | `app/verdict/page.tsx` (SSR shell) |

When refactoring moves owners again, **repoint these greps** in `scripts/truth-check.mjs` — do not leave the gate red on correct trees.
