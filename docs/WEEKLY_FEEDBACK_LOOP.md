# Weekly Feedback Loop

A weekly "deep feedback" report that combines two things into one read:

1. **Health & life** — a Claude-written analysis of the week's MY PENS data
   (weight, sleep, training, food, mood, Anchor recovery).
2. **Working with Claude** — an analysis of *how you ran your projects* that
   week: prompt volume, prompt quality (did prompts carry files/goals/
   constraints?), tool + subagent usage, and late-night prompting — parsed
   from your local Cursor / Claude Desktop transcripts.

It ends with three wins, three concrete prompting/project improvements, and
three health actions for the coming week. It also surfaces deterministic
**cross-links** (e.g. "late-night prompting tracked with short sleep").

## Why it runs locally

Your health data lives in Supabase (reachable via `DATABASE_URL`), but the
raw material for judging your prompts lives in local `.jsonl` transcript
files under `~/.cursor/projects` and `~/.claude/projects` — which a
Vercel-hosted app cannot read. So the generator runs **on your machine**,
does the analysis, and upserts a finished report into the DB. The web page
and the mobile app are read-only consumers.

```mermaid
flowchart TD
  cursor["Cursor .jsonl (local)"] --> script
  claudeDesk["Claude Desktop .jsonl (local)"] --> script
  db["Supabase health data"] --> script
  script["scripts/weekly-feedback.mjs"] --> claude["Claude Sonnet: deep analysis"]
  claude --> report["WeeklyFeedbackReport row + docs/reports/*.md"]
  report --> api["GET /api/weekly-feedback"]
  api --> web["/weekly-feedback (web)"]
  api --> mobile["Expo screen + Sunday reminder"]
```

## Running it

```bash
npm run feedback:weekly              # current ISO week (Mon–Sun)
node scripts/weekly-feedback.mjs --last          # previous full week
node scripts/weekly-feedback.mjs --week=2026-07-15   # week containing a date
node scripts/weekly-feedback.mjs --dry           # compute + print, no DB write
node scripts/weekly-feedback.mjs --no-ai         # deterministic only, no Claude
```

It always writes a Markdown copy to `docs/reports/weekly-feedback-<weekOf>.md`
(git-ignored — it contains personal health data) and, unless `--dry`, upserts
the `WeeklyFeedbackReport` row for that week.

### Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | for DB write | Reads health data, upserts the report. Without it the script forces `--dry`. |
| `ANTHROPIC_API_KEY` | optional | Enables the Claude deep analysis. Without it, a solid deterministic report is produced instead. |
| `PENS_TRANSCRIPT_DIRS` | optional | Comma-separated dirs of `.jsonl` transcripts. Defaults to `~/.cursor/projects` and `~/.claude/projects`. |
| `PENS_ISZE_FEEDBACK_DIR` | optional | Folder with Claude Desktop scheduled Feedback (`00_INDEX.md` + `Feedback_*.md`). Default: `~/Desktop/claude/ISZE/05_memory/briefs/feedback_history`. |
| `WEEKLY_FEEDBACK_MODEL` | optional | Model id. Default `claude-sonnet-4-6`. |

## Professional / ISZE Feedback (third section)

The Claude Desktop **Scheduled → Feedback** task stays the source of truth for
ISZE / professional work. The weekly generator **reads** the latest brief from
`feedback_history/` and adds a **Professional · ISZE** section to the report
(summary, open loops, 3 close-the-loop actions). It does not replace or rewrite
that archive.

On Windows the default path is:
`C:\Users\jerom\Desktop\claude\ISZE\05_memory\briefs\feedback_history`

## Garmin Analysis Engine

After data is in the DB, a deterministic engine deep-dives **everything** Garmin-related
(sleep, weight, activities, stress, HRV, steps, RHR, body battery) and computes
trends + correlations (e.g. stress↔sleep, HRV↔stress).

```cmd
npm run analyze:garmin           # current week
npm run analyze:garmin -- --all  # entire history
npm run analyze:garmin -- --last
```

Output: `docs/reports/garmin-analysis-<tag>.md`  
Also embedded into `npm run feedback:weekly` as `metrics.health.garminEngine`
(shown on `/weekly-feedback` as the orange **Garmin Analysis Engine** card) —
**this ISO week only**. Empty week stays empty; archive is never injected here.

## Period Review (multi-month advice)

Longer windows get their own system so advice matches the period you discuss:

| Window you mean | How to read it |
|-----------------|----------------|
| This week | `/weekly-feedback` only |
| Last 3 / 6 / 12 months | `/period-review` (or `npm run analyze:periods`) |
| A named stretch | Period Review lists good/mixed/bad stretches with dates |

**Example:** 3 strong months, then 9 weak months → **12-month verdict = bad**, but
the opening stretch is still labeled **good** when discussed alone. Advice is
always tagged with the period it applies to.

```cmd
npm run analyze:periods
npm run analyze:periods -- --as-of=2026-07-18
npm run analyze:periods -- --dry
```

Output: `docs/reports/period-review-<asOf>.md` + `PeriodReviewReport` row →
`GET /api/period-review` → `/period-review`.

Garmin Connect dumps are often a **historical archive** (2019+). Use Period
Review (or `npm run analyze:garmin -- --all`) for that history — not the weekly
overview.

## Garmin dump folder (local)

If you drop a Garmin export folder into the repo (e.g. a UUID folder full of
`.fit` / wellness JSON):

```cmd
python scripts\import-garmin-dump.py "ba80da99-886a-4f1b-989e-e41afa51d239_1"
```

Or run everything in one go:

```cmd
scripts\arrange-all.cmd "ba80da99-886a-4f1b-989e-e41afa51d239_1"
```

That imports from a Garmin Connect JSON dump into Postgres:

- activities → `GarminActivity` + `TrainingEntry`
- sleep → `SleepEntry` (deep+light seconds)
- weight → `WeightEntry`
- stress / HRV / steps / body battery / RHR / SpO2 / … → `GarminDailyMetric`

Then runs `npm run feedback:weekly` (health half includes Garmin wellness averages).

If `GarminDailyMetric` is missing, either apply migration
`20260718160000_garmin_daily_metrics` or let the importer `CREATE TABLE IF NOT EXISTS`.

For live sleep/weight without a dump, use `/garmin` → Sync sleep / Sync body weight
(needs Garmin OAuth connected under `/integrations`).

## Past weight without a Tanita CSV

You do not need Health Planet. Create a tiny CSV yourself and import it:

1. Open Notepad and paste (one row per day — change numbers):

```
date,scaleKg,bodyFatPct,muscleMassKg,bodyWaterPct,visceralFat
2026-07-18,84.9,19.2,65.25,52.2,7
2026-07-17,85.1,,,
2026-07-16,84.8,,,
```

2. Save as `weights.csv` (not `.txt`).
3. With the app running, open `/data` → upload that CSV (weight module is
   auto-detected from the `scaleKg` header).

Or log a few days by hand on `/weight` / the phone Weight tab.

### Scheduling a true weekly run

Run it every Sunday evening with your OS scheduler. Examples:

- **Windows Task Scheduler** — action: `node`, args:
  `C:\path\to\mypens\scripts\weekly-feedback.mjs`, weekly on Sunday 18:00,
  with `DATABASE_URL` / `ANTHROPIC_API_KEY` set in the task environment.
- **cron (macOS/Linux)** — `0 18 * * 0 cd /path/to/mypens && node scripts/weekly-feedback.mjs`.

## Where it shows up

- **Web:** `/weekly-feedback` — summary, wins/improvements/actions, health and
  Claude-work analysis with metric grids.
- **Mobile (Android/iOS):** a native "Weekly Feedback" screen, reachable from
  the Sleep tab, plus a **local reminder every Sunday at 18:00** that
  deep-links straight into the screen. The reminder is a plain local
  notification (no server push needed); the report is fetched on open.

## Data model

`WeeklyFeedbackReport` (see `prisma/schema.prisma`, migration
`20260718140000_weekly_feedback_report`):

| Field | Notes |
|-------|-------|
| `weekOf` | Monday of the ISO week (unique — re-runs upsert in place) |
| `weekEnd` | Sunday |
| `combinedSummary`, `healthAnalysis`, `claudeWorkAnalysis` | prose |
| `wins`, `improvements`, `healthActions` | JSON arrays (TEXT) |
| `metrics` | JSON blob (TEXT) of the deterministic metrics |
| `model` | model used, or `null` for the deterministic fallback |

## Privacy

- The **generated Markdown reports are git-ignored** (`docs/reports/`) because
  they contain personal health data.
- **Anchor** recovery data is only ever used in **aggregate** (clean-streak
  length, count of drinking days). No notes or event details are sent to the
  model or stored in the report.
- Transcript **contents never leave the script** except as short, truncated
  sample snippets sent to Claude for prompt-quality critique; only aggregate
  counts are stored.
- The API route is behind the same auth as everything else (`proxy.ts`:
  session cookie for web, `MOBILE_PENS_API_TOKEN` bearer for the app).

## Files

| File | Role |
|------|------|
| `scripts/weekly-feedback.mjs` | Generator (health + transcripts → Claude → DB + Markdown) |
| `scripts/lib/transcriptMetrics.mjs` | Parses `.jsonl` transcripts into prompt/project metrics |
| `scripts/lib/iszeFeedback.mjs` | Reads ISZE scheduled Feedback archive |
| `scripts/lib/weekDates.mjs` | ISO-week date helpers |
| `app/api/weekly-feedback/route.ts` | Read-only API (`?weekOf=`, `?list=1`) |
| `app/weekly-feedback/page.tsx` | Web page |
| `mypens-mobile/app/weekly-feedback.tsx` | Native screen |
| `mypens-mobile/lib/weeklyFeedbackNotifications.ts` | Sunday local reminder |
