# Cursor Spec — Task 2-D: Weekly PDF Report

**Paste this at the start of your Cursor session.**

---

## Context

You are working on MY PENS — a personal health tracking web app.
Repo: https://github.com/jeromio1987/mypens
Stack: Next.js 16, TypeScript, Tailwind CSS, Prisma ORM, Supabase (PostgreSQL), Recharts, Lucide React.
The app uses the App Router pattern. All API routes are in app/api/. All pages follow the same UI pattern: bg-pens-deep background, rounded-2xl navy cards, module-specific accent colours.
Read prisma/schema.prisma before making any changes.
Do not modify lib/retentionModels.ts without being explicitly asked.

---

## What to build

A "Download Weekly Report" button on the Dashboard that generates a PDF covering all modules for the previous 7 days.

---

## Step 1: Install dependency

```bash
npm install @react-pdf/renderer
```

---

## Step 2: API route

**`app/api/report/weekly/route.ts`**

- Method: GET
- Query param: `weekOf` (optional ISO date string, defaults to last Monday)
- Collect 7 days of data from database:
  - WeightEntry: trueWeightKg, scaleKg, bodyFatPct, muscleMassKg (where tanitaReliable=true)
  - FoodEntry: kcal, protein, carbs, fat, targetKcal
  - SleepEntry: hoursSlept, quality, hrv
  - TrainingEntry: exerciseName, sets, reps, weightKg, totalVolume
  - JournalEntry: mood, energy, note (if model exists)
- Generate PDF with @react-pdf/renderer
- Return as `application/pdf` response with Content-Disposition: attachment header

**PDF structure (6 pages):**

Page 1 — Cover
- "MY PENS WEEKLY REPORT"
- "Week of [Monday date] – [Sunday date]"
- Three highlight stats: best metric this week, worst metric, one sentence summary
- Style: dark background (#0f172a), white text, monospace for the audit feel

Page 2 — Weight & Body
- 7-day true weight table: date, trueWeightKg, delta vs prior day
- If Tanita data exists (tanitaReliable=true): body fat %, muscle mass kg, water %
- Week summary: start weight, end weight, net change

Page 3 — Nutrition
- Daily table: date, kcal, protein g, carbs g, fat g, vs target (✓/✗)
- Week averages: avg kcal, avg protein, avg carbs, avg fat
- Days on target: N/7

Page 4 — Sleep
- Daily table: date, hours slept, quality score (1-5), HRV if available
- Week averages: avg hours, avg quality
- Sleep debt note: if avg < 7.5h, show cumulative deficit

Page 5 — Training
- Sessions this week: date, exercises, sets×reps@weight, total session volume
- Week totals: total volume (kg), session count
- Top 3 exercises by volume this week

Page 6 — Wellbeing (only if JournalEntry model exists and has data)
- Daily mood + energy table (1-5 scale)
- Week averages
- Any notes from the week (truncated to 150 chars each)
- If no journal data: skip this page entirely

**Style rules:**
- Monochrome only: black (#000), white (#fff), gray shades (#111, #333, #666, #eee)
- No colour backgrounds except page 1 cover
- Font: use @react-pdf/renderer built-in fonts (Helvetica or Courier for mono sections)
- Tables: thin gray borders, alternating row shading (#f9f9f9)
- Page numbers in footer

---

## Step 3: Dashboard button

In `app/dashboard/page.tsx` (or wherever the dashboard lives), add a "Download weekly report" section:

- Small "Download Weekly Report" button — secondary style, with a Download icon from Lucide
- Optional date picker: "Week of [date]" — defaults to last full week (Mon–Sun)
- On click: fetch `/api/report/weekly?weekOf=[date]` and trigger browser download
- Show a spinner while generating
- On error: show a toast "Report generation failed"

Place it near the bottom of the dashboard, below the weekly summary cards if they exist.

---

## Definition of done

1. `npm run dev` starts without errors
2. Click "Download Weekly Report" on dashboard
3. PDF downloads in under 5 seconds
4. PDF has correct data for the selected week
5. All 5 pages present (6 if journal data exists)
6. PDF is clean, readable, monochrome

---

## Notes
- Check if JournalEntry model exists in prisma/schema.prisma before trying to query it — if it doesn't exist, skip Page 6 gracefully
- Do NOT modify lib/retentionModels.ts
- The PDF is a static document — no interactivity needed
- If any module has no data for the week, include the page with "No data logged this week" rather than skipping it (except Journal — skip that page if no model or no data)
