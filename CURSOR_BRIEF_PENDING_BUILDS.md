# MY PENS — Cursor Build Brief: Pending Builds

**For:** Cursor
**Date:** May 2026
**From:** Jerome (Claude-assisted)
**Paste context first** (from master roadmap Appendix) before starting any task.

These four tasks can run in parallel. Start with whichever you have most context on. Do NOT build what already exists — check `prisma/schema.prisma`, `app/` directory, and the roadmap True Current State section before touching anything.

---

## TASK A — Landing Page (3-D)

**Priority:** High. No public page exists at all.
**Effort:** ~1 day
**Copy:** All copy is ready in `LANDING_PAGE_COPY.md` — use verbatim, do not invent new copy.

### Spec

Build `app/page.tsx` as a public-facing landing page. This replaces the current root route if it exists, or is a new page. The app itself lives at `/dashboard` or `/login`.

**Sections (in order):**
1. **Nav bar** — Logo ("MY PENS"), "Sign In" button (→ `/login`). Minimal. No links to unauthenticated content.
2. **Hero** — Headline: "Track The Signal". Sub: from copy file. CTA button "Start Tracking" → `/login`. Full viewport height. Background: `#111827` (dark). White text. Accent: `#2563eb` (blue-600).
3. **Problem section** — Copy from file. 2-column layout on desktop. Lighter dark background (`#1f2937`).
4. **What it does** — 5 feature items from copy file. Icon per item from Lucide React:
   - Weight noise → `Scale`
   - Body composition → `Activity`
   - Training → `Dumbbell`
   - Sleep → `Moon`
   - Verdict → `FileCheck`
5. **Who it is / is not for** — 2-column side-by-side. "For" left, "Not for" right. Minimal cards.
6. **Quote / social proof** — single quote from copy file. Centred, italic. Gray-400.
7. **Footer CTA** — "Bring receipts to your health data" + "Start Tracking" button. Same style as hero.
8. **Footer** — "MY PENS — Personal audit, no noise." Privacy Policy link → `/privacy` (if it exists).

**Visual rules:**
- Dark palette only: `#0f172a` / `#111827` / `#1f2937` backgrounds
- White text primary, `#94a3b8` secondary
- Blue-600 (`#2563eb`) for all CTAs and accent marks
- Font: use system sans stack — no custom font install needed
- Fully mobile-responsive
- No images required — typography-led

**DO NOT:** Add any new npm packages just for the landing page. Use Tailwind classes only.

---

## TASK B — Onboarding Build (3-B)

**Priority:** Medium. First-run UX improvement.
**Effort:** ~1 day
**Copy:** All copy ready in `ONBOARDING_COPY.md`. Use verbatim.

### Current state
Check `app/onboarding/` — a flow likely exists. Read it before touching anything. The task is to REVIEW what exists, add missing steps, not rebuild from scratch.

### What needs to be in the flow (4 steps + skip)

Per `ONBOARDING_COPY.md`:
1. "Audit The Daily Noise" — intro to Weight / Food / Sleep
2. "Log The Evidence" — Training / Measurements / Journal
3. "Face The Verdict" — Verdict / Clubroom / Dopamine router
4. "Anchor Stays Private" — Anchor module intro (with skip)

Plus a "Skip All → Dashboard" option at any point.

### Missing from current flow (likely)
- Step 4 (Anchor) — probably not there, added late in development
- Wearable integrations intro — point users to `/settings/integrations` after onboarding, not during (too complex for step 1)
- "Quick setup" option — after name + weight target entered, skip directly to dashboard without going through all 4 steps

### Build rules
- Match existing onboarding visual style (don't redesign)
- Add Anchor step as a modal or final step with strong "Skip" affordance (Anchor is optional and personal)
- Store `onboarding_complete: true` in UserSettings (or localStorage if no DB field) after completion
- If user dismisses onboarding mid-way, mark as complete anyway — don't show it again
- No new packages

---

## TASK C — Workout Programme Builder (2-C)

**Priority:** Medium. Most-wanted power-user feature.
**Effort:** ~1.5 days
**Full spec:** Already in `mypens-master-roadmap.md` → TASK 2-C. Read it fully before starting.

### Quick brief

Schema to add (run `npx prisma migrate dev --name add-programmes` after):
```prisma
Programme → ProgrammeDay → ProgrammeExercise
```
(Full schema with field names is in the roadmap — copy exactly, do not improvise)

Key deliverable: "Start Session" button on Training page. If an active Programme exists, it shows a day picker → pre-fills the training form. User adjusts actual weight/reps. Programme template is the target, TrainingEntry is the actual.

DO NOT gate this feature yet — the Premium gate spec says to add a lock icon but keep the feature accessible in free tier until monetization is live.

---

## TASK D — Weekly PDF Report (2-D)

**Priority:** Low. Nice-to-have, not blocking.
**Effort:** ~1 day
**Full spec:** Already in `mypens-master-roadmap.md` → TASK 2-D. Read it fully before starting.

### Quick brief

```bash
npm install @react-pdf/renderer
```

New route: `app/api/report/weekly/route.ts` → returns a PDF binary.
Trigger: "Download weekly report" button on Dashboard, date picker defaults to last Monday.

PDF is 6 pages: Cover, Weight+Body, Nutrition, Sleep, Training, Wellbeing.
Style: monochrome — no colour backgrounds. Match the audit aesthetic.

If AI Verdict summary (Task 2-A) produced output this week, include the 80-word summary on the Cover page.

---

## Paste this before starting any session:

```
You are working on MY PENS — a personal health tracking web app.
Repo: https://github.com/jeromio1987/mypens
Stack: Next.js 16, TypeScript, Tailwind CSS, Prisma ORM, Supabase (PostgreSQL), Recharts, Lucide React.
The app uses the App Router pattern. All API routes are in app/api/. All pages follow the same UI pattern: bg-pens-deep background, rounded-2xl navy cards, module-specific accent colours.
Read prisma/schema.prisma before making any changes.
Do not modify lib/retentionModels.ts without being explicitly asked — this is the core weight engine.
Run npx prisma migrate dev --name <name> after any schema changes.
```
