# Shell inventory — WP 3.1 (2026-07-26)

| Screen | Class | Decision |
|--------|-------|----------|
| `(tabs)/read` | real | keep |
| `(tabs)/food` Fueling | real | keep |
| `(tabs)/training` Train | real (API) / partial offline | keep; kill Supabase when API on |
| `(tabs)/audit` | real hub | keep |
| `(tabs)/index` Weight | real capture | hide from tabs; via Audit/Read |
| `(tabs)/sleep` | real | hide from tabs; via Audit/Read |
| `dopamine-debt` | shell | hide from nav (route may remain) |
| `app/mockups/*` | shell | stay out of destinations |
| Verdict `/verdict` | real (scores migrating to cockpit) | keep as Audit |
| Period review | real | = Read |
| Planner | partial | via Audit |
| Bloodwork | real | via Audit |
| Weekly feedback | partial | via Audit; fase 4.5 deepens |

No "Shell" chip labels in primary UI after WP 3.2.
