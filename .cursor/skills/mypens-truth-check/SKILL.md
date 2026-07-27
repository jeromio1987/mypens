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
