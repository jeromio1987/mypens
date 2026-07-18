#!/usr/bin/env node
// =============================================================================
// MY PENS — Weekly Feedback Loop generator
//
// Produces one WeeklyFeedbackReport per ISO week that combines:
//   1. a deep analysis of the week's health / life data (weight, sleep,
//      training, food, mood, Anchor recovery), and
//   2. an analysis of how you worked with Claude / Cursor that week
//      (prompt volume + quality, tool/subagent usage, late-night prompting),
//      parsed from your LOCAL agent transcripts.
//
// Why local: the health data lives in Supabase (reachable via DATABASE_URL),
// but the transcript `.jsonl` files live on your machine and can't be read
// from Vercel. So this script runs locally, does the analysis, and upserts a
// finished report into the DB. The web + mobile clients just read it.
//
// Usage:
//   node scripts/weekly-feedback.mjs                # current ISO week (Mon–Sun)
//   node scripts/weekly-feedback.mjs --last         # previous full week
//   node scripts/weekly-feedback.mjs --week=2026-07-15   # week containing a date
//   node scripts/weekly-feedback.mjs --dry          # compute + print, no DB write
//   node scripts/weekly-feedback.mjs --no-ai        # skip Claude, deterministic only
//
// Env:
//   DATABASE_URL          required for DB read/write (falls back to --dry)
//   ANTHROPIC_API_KEY     optional — enables the Claude deep analysis
//   PENS_TRANSCRIPT_DIRS  optional — comma-separated dirs of .jsonl transcripts
//                         (defaults to ~/.cursor/projects and ~/.claude/projects)
//   PENS_ISZE_FEEDBACK_DIR optional — folder with Claude scheduled Feedback
//                         (00_INDEX.md + Feedback_*.md). Default:
//                         ~/Desktop/claude/ISZE/05_memory/briefs/feedback_history
//   WEEKLY_FEEDBACK_MODEL optional — model id (default claude-sonnet-4-6)
// =============================================================================

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { weekBounds, shiftDateStr } from './lib/weekDates.mjs'
import { findTranscriptFiles, computeWeekMetrics, defaultTranscriptDirs } from './lib/transcriptMetrics.mjs'
import { loadIszeFeedback, defaultIszeFeedbackDir } from './lib/iszeFeedback.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const MODEL = process.env.WEEKLY_FEEDBACK_MODEL?.trim() || 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Minimal .env loader (no dependency). Next.js / Prisma read .env on their
// own, but this standalone script does not — so load it here to keep the
// weekly run to a single command. Existing env vars always win.
// ---------------------------------------------------------------------------
function loadDotEnv(root) {
  const p = join(root, '.env')
  if (!existsSync(p)) return
  let txt
  try {
    txt = readFileSync(p, 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { dry: false, ai: true, week: null, last: false }
  for (const a of argv.slice(2)) {
    if (a === '--dry') args.dry = true
    else if (a === '--no-ai') args.ai = false
    else if (a === '--last') args.last = true
    else if (a.startsWith('--week=')) args.week = a.slice('--week='.length)
  }
  return args
}

function resolveWeek(args) {
  if (args.week) return weekBounds(args.week)
  const base = weekBounds(new Date())
  if (args.last) {
    const prevAnchor = shiftDateStr(base.weekOf, -1)
    return weekBounds(prevAnchor)
  }
  return base
}

// ---------------------------------------------------------------------------
// Health / life aggregation (Prisma) — mirrors the framing used by
// app/api/verdict/summary/route.ts but scoped to a Mon–Sun window and
// extended with Anchor recovery signals.
// ---------------------------------------------------------------------------
/** Per-table query that never kills the whole report on schema drift. */
async function safeQuery(label, fn, fallback = []) {
  try {
    return await fn()
  } catch (err) {
    console.warn(`[weekly-feedback] ${label} skipped:`, err?.message?.split('\n')[0] || err)
    return fallback
  }
}

async function collectHealthMetrics(prisma, weekOf, weekEnd) {
  const range = { gte: weekOf, lte: weekEnd }

  // Select only columns we actually use — avoids hard-failing when the
  // live DB is behind the Prisma schema (e.g. missing JournalEntry.voicePath).
  const [weights, foods, sleeps, trainings, journals, days, recovery, cravings, milestones] =
    await Promise.all([
      safeQuery('weight', () =>
        prisma.weightEntry.findMany({
          where: { date: range },
          orderBy: { date: 'asc' },
          select: { date: true, trueWeightKg: true, scaleKg: true },
        }),
      ),
      safeQuery('food', () =>
        prisma.foodEntry.findMany({
          where: { date: range },
          select: { date: true, kcal: true, proteinG: true },
        }),
      ),
      safeQuery('sleep', () =>
        prisma.sleepEntry.findMany({
          where: { date: range },
          orderBy: { date: 'asc' },
          select: { date: true, hours: true, quality: true },
        }),
      ),
      safeQuery('training', () =>
        prisma.trainingEntry.findMany({
          where: { date: range },
          select: { date: true, volume: true },
        }),
      ),
      safeQuery('journal', () =>
        prisma.journalEntry.findMany({
          where: { date: range },
          select: { date: true, mood: true },
        }),
      ),
      safeQuery('day', () =>
        prisma.dayEntry.findMany({
          where: { date: range },
          select: { date: true, mode: true, tags: true },
        }),
      ),
      // Anchor: aggregate only — never notes.
      safeQuery('recovery', () =>
        prisma.recoveryEntry.findMany({
          orderBy: { date: 'desc' },
          take: 400,
          select: {
            date: true,
            alcoholDrinks: true,
            cocaineUsed: true,
            escortUsed: true,
          },
        }),
      ),
      safeQuery('cravings', () =>
        prisma.cravingEvent.findMany({
          where: {
            createdAt: {
              gte: new Date(`${weekOf}T00:00:00`),
              lte: new Date(`${weekEnd}T23:59:59`),
            },
          },
          select: { outcome: true },
        }),
      ),
      safeQuery('milestones', () =>
        prisma.recoveryMilestone.findMany({
          where: { date: range },
          select: { date: true, kind: true, label: true },
        }),
      ),
    ])

  // --- Weight ---
  let weight = null
  if (weights.length > 0) {
    const avgTrue = weights.reduce((s, w) => s + w.trueWeightKg, 0) / weights.length
    const byDate = new Map()
    for (const w of weights) {
      const list = byDate.get(w.date) ?? []
      list.push(w.trueWeightKg)
      byDate.set(w.date, list)
    }
    const dates = [...byDate.keys()].sort()
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length
    const first = mean(byDate.get(dates[0]))
    const last = mean(byDate.get(dates[dates.length - 1]))
    const delta = last - first
    weight = {
      entries: weights.length,
      avgTrueKg: round(avgTrue, 2),
      firstKg: round(first, 2),
      lastKg: round(last, 2),
      trend: delta > 0.1 ? 'up' : delta < -0.1 ? 'down' : 'flat',
      deltaKg: round(delta, 2),
    }
  }

  // --- Sleep ---
  let sleep = null
  if (sleeps.length > 0) {
    const hours = sleeps.map(s => s.hours)
    sleep = {
      nights: sleeps.length,
      avgHours: round(hours.reduce((a, b) => a + b, 0) / hours.length, 2),
      avgQuality: round(sleeps.reduce((s, x) => s + x.quality, 0) / sleeps.length, 1),
      nightsUnder6h5: sleeps.filter(s => s.hours < 6.5).length,
      minHours: round(Math.min(...hours), 2),
      maxHours: round(Math.max(...hours), 2),
    }
  }

  // --- Training ---
  const trainDates = new Set(trainings.map(t => t.date))
  const training = {
    sessions: trainDates.size,
    entries: trainings.length,
    totalVolumeKg: Math.round(trainings.reduce((s, t) => s + (t.volume || 0), 0)),
  }

  // --- Food ---
  const foodDays = new Set(foods.map(f => f.date))
  const denom = Math.max(foodDays.size, 1)
  const food =
    foods.length === 0
      ? null
      : {
          daysLogged: foodDays.size,
          avgKcalPerDay: Math.round(foods.reduce((s, f) => s + (f.kcal || 0), 0) / denom),
          avgProteinPerDay: Math.round(foods.reduce((s, f) => s + (f.proteinG || 0), 0) / denom),
        }

  // --- Mood (journal) ---
  const moods = journals.map(j => j.mood).filter(m => m != null)
  const mood =
    moods.length === 0
      ? null
      : {
          entries: journals.length,
          avgMood: round(moods.reduce((a, b) => a + b, 0) / moods.length, 1),
          journalDays: journals.length,
        }

  // --- Mode (DayEntry) ---
  const modeCounts = { locked_in: 0, balanced: 0, off: 0 }
  const tagCounts = {}
  for (const d of days) {
    if (d.mode && modeCounts[d.mode] != null) modeCounts[d.mode]++
    try {
      const tags = JSON.parse(d.tags || '[]')
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1
    } catch {
      /* ignore malformed tags */
    }
  }

  // --- Anchor (recovery) — aggregate only ---
  let anchor = null
  if (recovery.length > 0) {
    // Running clean streak as of weekEnd, walking backwards.
    const byDate = new Map(recovery.map(e => [e.date, e]))
    let cursor = weekEnd
    let cleanStreak = 0
    for (let i = 0; i < 365 * 5; i++) {
      const e = byDate.get(cursor)
      if (e && (e.alcoholDrinks > 0 || e.cocaineUsed || e.escortUsed)) break
      cleanStreak++
      cursor = shiftDateStr(cursor, -1)
    }
    const inWeek = recovery.filter(e => e.date >= weekOf && e.date <= weekEnd)
    anchor = {
      cleanStreakDays: cleanStreak,
      daysLoggedThisWeek: inWeek.length,
      alcoholDaysThisWeek: inWeek.filter(e => e.alcoholDrinks > 0).length,
      totalDrinksThisWeek: inWeek.reduce((s, e) => s + (e.alcoholDrinks || 0), 0),
      cocaineDaysThisWeek: inWeek.filter(e => e.cocaineUsed).length,
      escortDaysThisWeek: inWeek.filter(e => e.escortUsed).length,
      cravingEvents: cravings.length,
      cravingsResisted: cravings.filter(c => c.outcome === 'resisted').length,
      cravingsSlipped: cravings.filter(c => c.outcome === 'slipped').length,
    }
  }

  return {
    weight,
    sleep,
    training,
    food,
    mood,
    mode: { counts: modeCounts, tags: tagCounts, daysLogged: days.length },
    anchor,
    milestones: milestones.map(m => ({ date: m.date, kind: m.kind, label: m.label })),
  }
}

function round(n, dp) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// ---------------------------------------------------------------------------
// Cross-link insight: late-night prompting vs same-week sleep. This is the
// bit that ties the two halves of the report together deterministically.
// ---------------------------------------------------------------------------
function crossLink(health, work) {
  const notes = []
  if (work.available && work.lateNightPromptCount >= 3) {
    if (health.sleep && health.sleep.avgHours < 7) {
      notes.push(
        `${work.lateNightPromptCount} prompts landed after 22:00 this week and average sleep was ${health.sleep.avgHours}h — the late Claude sessions and short nights are moving together.`,
      )
    } else {
      notes.push(`${work.lateNightPromptCount} prompts happened after 22:00 — watch the knock-on to sleep.`)
    }
  }
  if (work.available && health.anchor && work.lateNightPromptCount >= 3 && health.anchor.alcoholDaysThisWeek > 0) {
    notes.push('Late-night work and non-clean Anchor days co-occurred — a known impulse window for you.')
  }
  return notes
}

// ---------------------------------------------------------------------------
// Claude deep analysis (optional). Returns the structured sections or null.
// ---------------------------------------------------------------------------
async function runClaude({ weekOf, weekEnd, health, work, links, isze }) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null

  let Anthropic
  try {
    ;({ default: Anthropic } = await import('@anthropic-ai/sdk'))
  } catch {
    return null
  }

  const system = `You are MY PENS Weekly Feedback — a sharp, honest personal review system for a single power-user.
You produce a weekly review with three connected parts: (1) health/life data, (2) how well the user worked with Claude/Cursor this week (prompt quality), and (3) professional/ISZE feedback already produced by a Claude Desktop scheduled task (summarise it; do not invent ISZE facts).
Voice: direct, analytical, a little dry. No wellness platitudes, no corporate filler, no em-dashes. Prefer concrete numbers from the data. Be specific and useful, not generic.
For the Claude-work half: judge prompt quality on specificity, included context (files/goals/constraints), and whether short vague prompts caused rework. Give concrete, actionable prompting upgrades the user can apply next week.
For ISZE: emphasise closing open loops that keep recurring (e.g. CLAUDE.md staleness). If no ISZE brief is available, say so briefly in iszeAnalysis.
Respect privacy: Anchor recovery data is sensitive; refer to it only in aggregate (streaks, counts), never speculate about details.
Return ONLY valid minified JSON, no markdown fences, with exactly these keys:
{"combinedSummary": string (2-4 sentences, the headline read on the week), "healthAnalysis": string (1 short paragraph), "claudeWorkAnalysis": string (1 short paragraph), "iszeAnalysis": string (1 short paragraph on professional/ISZE feedback), "wins": string[] (exactly 3), "improvements": string[] (exactly 3, about prompting/project execution), "healthActions": string[] (exactly 3, concrete next-week health actions), "iszeActions": string[] (exactly 3, concrete next-week ISZE close-the-loop actions — empty array if no ISZE data)}`

  const userPrompt = `Week: ${weekOf} to ${weekEnd}

HEALTH / LIFE DATA (JSON):
${JSON.stringify(health)}

CLAUDE / CURSOR WORK DATA (JSON, parsed from local transcripts):
${JSON.stringify({
    available: work.available,
    sessions: work.sessions,
    promptCount: work.promptCount,
    avgPromptChars: work.avgPromptChars,
    medianPromptChars: work.medianPromptChars,
    avgPromptWords: work.avgPromptWords,
    longPromptCount: work.longPromptCount,
    shortPromptCount: work.shortPromptCount,
    contextInclusionRate: work.contextInclusionRate,
    toolUseCount: work.toolUseCount,
    subagentCount: work.subagentCount,
    toolUsePerPrompt: work.toolUsePerPrompt,
    lateNightPromptCount: work.lateNightPromptCount,
    earlyMorningPromptCount: work.earlyMorningPromptCount,
    samplePrompts: work.samplePrompts,
  })}

ISZE / PROFESSIONAL SCHEDULED FEEDBACK (JSON — already written by Claude Desktop; summarise, do not invent):
${JSON.stringify(
    isze?.available
      ? {
          available: true,
          latestName: isze.latestName,
          latestDate: isze.latestDate,
          runCount: isze.runCount,
          summary: isze.summary,
          openLoops: isze.openLoops,
          excerpt: isze.excerpt,
        }
      : { available: false, reason: isze?.reason ?? 'missing' },
  )}

DETERMINISTIC CROSS-LINKS:
${links.length ? links.map(l => `- ${l}`).join('\n') : '- none detected'}

Write the review now as JSON.`

  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1400,
    stream: false,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  return parseClaudeJson(text)
}

function parseClaudeJson(text) {
  if (!text) return null
  let cleaned = text.trim()
  // Strip ```json ... ``` fences if the model added them anyway.
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) cleaned = fence[1].trim()
  // Fall back to the outermost {...} if there's stray prose.
  if (!cleaned.startsWith('{')) {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  }
  try {
    const obj = JSON.parse(cleaned)
    return {
      combinedSummary: String(obj.combinedSummary || ''),
      healthAnalysis: String(obj.healthAnalysis || ''),
      claudeWorkAnalysis: String(obj.claudeWorkAnalysis || ''),
      iszeAnalysis: String(obj.iszeAnalysis || ''),
      wins: asStringArray(obj.wins),
      improvements: asStringArray(obj.improvements),
      healthActions: asStringArray(obj.healthActions),
      iszeActions: asStringArray(obj.iszeActions),
    }
  } catch {
    return null
  }
}

function asStringArray(v) {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x)).filter(Boolean).slice(0, 5)
}

// ---------------------------------------------------------------------------
// Deterministic fallback — used when there's no API key, the call fails, or
// JSON can't be parsed. Keeps the feature fully usable offline.
// ---------------------------------------------------------------------------
function buildFallback({ health, work, links, isze }) {
  const h = []
  if (health.sleep) h.push(`Sleep averaged ${health.sleep.avgHours}h across ${health.sleep.nights} nights (quality ${health.sleep.avgQuality}/5, ${health.sleep.nightsUnder6h5} short nights).`)
  if (health.weight) h.push(`True weight trend ${health.weight.trend} ${Math.abs(health.weight.deltaKg)}kg, ending ${health.weight.lastKg}kg.`)
  if (health.training.sessions) h.push(`${health.training.sessions} training sessions, ${health.training.totalVolumeKg}kg total volume.`)
  if (health.food) h.push(`Food: ~${health.food.avgKcalPerDay} kcal/day, ${health.food.avgProteinPerDay}g protein over ${health.food.daysLogged} logged days.`)
  if (health.mood) h.push(`Mood averaged ${health.mood.avgMood}/5.`)
  if (health.anchor) h.push(`Anchor: ${health.anchor.cleanStreakDays}-day clean streak, ${health.anchor.alcoholDaysThisWeek} drinking day(s) this week.`)
  if (h.length === 0) h.push('No health data logged this week — nothing to analyse.')

  const w = []
  if (work.available) {
    w.push(`${work.promptCount} prompts across ${work.sessions} sessions (avg ${work.avgPromptChars} chars, ${Math.round(work.contextInclusionRate * 100)}% carried explicit context).`)
    if (work.shortPromptCount > 0) w.push(`${work.shortPromptCount} very short prompts (<60 chars) — the most common cause of rework.`)
    w.push(`${work.toolUseCount} tool calls, ${work.subagentCount} subagent delegations; ${work.lateNightPromptCount} prompts after 22:00.`)
  } else {
    w.push('No transcripts found for this week (set PENS_TRANSCRIPT_DIRS if they live elsewhere).')
  }

  const wins = []
  if (health.sleep && health.sleep.avgHours >= 7) wins.push('Held sleep at 7h+ on average.')
  if (health.training.sessions >= 3) wins.push(`${health.training.sessions} training sessions logged.`)
  if (health.anchor && health.anchor.alcoholDaysThisWeek === 0) wins.push(`Clean week on Anchor (streak ${health.anchor.cleanStreakDays}d).`)
  if (work.available && work.contextInclusionRate >= 0.6) wins.push('Most prompts carried real context.')
  while (wins.length < 3) wins.push('Kept logging data — consistency is the win.')

  const improvements = []
  if (work.available && work.shortPromptCount > work.longPromptCount) improvements.push('Front-load prompts with the goal, the file(s), and the constraints instead of one-liners.')
  if (work.available && work.contextInclusionRate < 0.5) improvements.push('Reference concrete files (@path) and paste the acceptance criteria more often.')
  if (work.available && work.lateNightPromptCount >= 3) improvements.push('Move deep Claude sessions earlier — late-night prompting tracked with short sleep.')
  improvements.push('End each session by writing the next prompt so momentum carries over.')
  improvements.push('Batch related asks into one well-scoped prompt to cut tool churn.')

  const healthActions = []
  if (health.sleep && health.sleep.avgHours < 7) healthActions.push('Set a hard phone-down time to claw back 30 min of sleep.')
  if (health.training.sessions < 3) healthActions.push('Book three training slots into next week now.')
  if (health.anchor && health.anchor.alcoholDaysThisWeek > 0) healthActions.push('Pre-plan the weekend high-risk slot with a substitute activity.')
  healthActions.push('Log weight + sleep every morning to keep the signal clean.')
  healthActions.push('Do one novelty activity to spend dopamine deliberately.')

  let iszeAnalysis = 'No ISZE scheduled Feedback brief found for this week.'
  const iszeActions = []
  if (isze?.available) {
    iszeAnalysis = isze.summary || 'ISZE Feedback brief present.'
    if (isze.openLoops?.length) {
      iszeAnalysis += ` Open loops: ${isze.openLoops.slice(0, 3).join('; ')}.`
    }
    iszeActions.push('Close one recurring CLAUDE.md stale item this week (pick the oldest).')
    iszeActions.push('Update 00_INDEX.md only after the underlying fact is fixed.')
    iszeActions.push('Keep personal recovery out of the ISZE Feedback run — that stays in MY PENS.')
  }

  return {
    combinedSummary:
      (links[0] || (work.available ? 'A mixed week across health and how you ran Claude.' : 'Health-only review this week; no transcript data available.')),
    healthAnalysis: h.join(' '),
    claudeWorkAnalysis: w.join(' ') + (links.length ? ` Cross-link: ${links.join(' ')}` : ''),
    iszeAnalysis,
    wins: wins.slice(0, 3),
    improvements: improvements.slice(0, 3),
    healthActions: healthActions.slice(0, 3),
    iszeActions: iszeActions.slice(0, 3),
  }
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------
function toMarkdown({ weekOf, weekEnd, report, metrics, model }) {
  const list = arr => arr.map(x => `- ${x}`).join('\n')
  return `# Weekly Feedback — ${weekOf} to ${weekEnd}

_Generated ${new Date().toISOString()} · ${model ? `model: ${model}` : 'deterministic (no AI)'}_

## Summary
${report.combinedSummary}

## Health & life
${report.healthAnalysis}

## Working with Claude
${report.claudeWorkAnalysis}

## Professional / ISZE (scheduled Feedback)
${report.iszeAnalysis || '_No ISZE brief loaded._'}

${report.iszeActions?.length ? `## ISZE actions (close the loop)\n${list(report.iszeActions)}\n` : ''}
## Wins
${list(report.wins)}

## Improvements (prompting & projects)
${list(report.improvements)}

## Health actions for next week
${list(report.healthActions)}

---
<details><summary>Raw metrics</summary>

\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`
</details>
`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadDotEnv(REPO_ROOT)
  const args = parseArgs(process.argv)
  const { weekOf, weekEnd } = resolveWeek(args)
  console.log(`[weekly-feedback] week ${weekOf} → ${weekEnd}`)

  // Transcript metrics (always available; degrades to empty).
  const dirs = defaultTranscriptDirs()
  const files = findTranscriptFiles(dirs)
  const work = computeWeekMetrics({ files, weekStart: weekOf, weekEnd })
  console.log(
    `[weekly-feedback] transcripts: ${files.length} files, ${work.sessions} sessions, ${work.promptCount} prompts in window`,
  )

  // ISZE scheduled Feedback archive (Claude Desktop) — local folder only.
  const iszeDir = defaultIszeFeedbackDir()
  const isze = loadIszeFeedback({ dir: iszeDir, weekOf, weekEnd })
  console.log(
    isze.available
      ? `[weekly-feedback] ISZE Feedback: ${isze.latestName} (${isze.runCount} briefs in archive)`
      : `[weekly-feedback] ISZE Feedback: not found (${isze.reason || 'missing'}) under ${iszeDir}`,
  )

  // Health metrics (needs a DB connection).
  const hasDb = Boolean(process.env.DATABASE_URL)
  let prisma = null
  let health
  if (hasDb) {
    try {
      const { PrismaClient } = await import('@prisma/client')
      prisma = new PrismaClient()
      health = await collectHealthMetrics(prisma, weekOf, weekEnd)
      console.log('[weekly-feedback] health metrics collected')
    } catch (err) {
      console.warn('[weekly-feedback] DB unavailable, health metrics skipped:', err?.message || err)
      health = emptyHealth()
    }
  } else {
    console.warn('[weekly-feedback] no DATABASE_URL — health metrics skipped, forcing --dry')
    args.dry = true
    health = emptyHealth()
  }

  const links = crossLink(health, work)

  // Analysis: Claude if possible, deterministic fallback otherwise.
  let report = null
  let model = null
  if (args.ai) {
    try {
      report = await runClaude({ weekOf, weekEnd, health, work, links, isze })
      if (report && report.combinedSummary) {
        model = MODEL
        console.log(`[weekly-feedback] Claude analysis ok (${MODEL})`)
      } else if (report) {
        console.warn('[weekly-feedback] Claude returned empty/invalid JSON — using fallback')
        report = null
      }
    } catch (err) {
      console.warn('[weekly-feedback] Claude call failed — using fallback:', err?.message || err)
    }
  }
  if (!report) {
    report = buildFallback({ health, work, links, isze })
  }
  // Ensure keys exist even if an older Claude response omitted them.
  report.iszeAnalysis = report.iszeAnalysis || (isze.available ? isze.summary : 'No ISZE brief loaded.')
  report.iszeActions = Array.isArray(report.iszeActions) ? report.iszeActions : []

  const metrics = {
    weekOf,
    weekEnd,
    health,
    work: stripSamples(work),
    crossLinks: links,
    isze: {
      ...stripIsze(isze),
      analysis: report.iszeAnalysis,
      actions: report.iszeActions,
    },
  }

  // Write markdown copy.
  try {
    const dir = join(REPO_ROOT, 'docs', 'reports')
    mkdirSync(dir, { recursive: true })
    const mdPath = join(dir, `weekly-feedback-${weekOf}.md`)
    writeFileSync(mdPath, toMarkdown({ weekOf, weekEnd, report, metrics, model }), 'utf8')
    console.log(`[weekly-feedback] wrote ${mdPath}`)
  } catch (err) {
    console.warn('[weekly-feedback] could not write markdown:', err?.message || err)
  }

  // Persist to DB (unless --dry).
  if (!args.dry && prisma) {
    const now = new Date()
    const data = {
      weekEnd,
      combinedSummary: report.combinedSummary,
      healthAnalysis: report.healthAnalysis,
      claudeWorkAnalysis: report.claudeWorkAnalysis,
      wins: JSON.stringify(report.wins),
      improvements: JSON.stringify(report.improvements),
      healthActions: JSON.stringify(report.healthActions),
      metrics: JSON.stringify(metrics),
      model,
      generatedAt: now,
    }
    await prisma.weeklyFeedbackReport.upsert({
      where: { weekOf },
      create: { weekOf, ...data },
      update: data,
    })
    console.log(`[weekly-feedback] upserted WeeklyFeedbackReport for ${weekOf}`)
  } else {
    console.log('[weekly-feedback] dry run — not writing to DB')
    console.log(JSON.stringify(report, null, 2))
  }

  if (prisma) await prisma.$disconnect()
}

function stripSamples(work) {
  const { samplePrompts, ...rest } = work
  return { ...rest, samplePromptCount: samplePrompts?.length ?? 0 }
}

/** Persist a lean ISZE blob (no multi-KB excerpt) plus the prose/actions. */
function stripIsze(isze) {
  if (!isze) return { available: false }
  return {
    available: Boolean(isze.available),
    dir: isze.dir ?? null,
    latestName: isze.latestName ?? null,
    latestDate: isze.latestDate ?? null,
    runCount: isze.runCount ?? 0,
    qualityNote: isze.qualityNote ?? null,
    summary: isze.summary ?? null,
    openLoops: isze.openLoops ?? [],
    reason: isze.reason ?? null,
  }
}

function emptyHealth() {
  return {
    weight: null,
    sleep: null,
    training: { sessions: 0, entries: 0, totalVolumeKg: 0 },
    food: null,
    mood: null,
    mode: { counts: { locked_in: 0, balanced: 0, off: 0 }, tags: {}, daysLogged: 0 },
    anchor: null,
    milestones: [],
  }
}

main().catch(err => {
  console.error('[weekly-feedback] fatal:', err)
  process.exit(1)
})
