// Transcript metrics for the Weekly Feedback Loop.
//
// Parses Cursor + Claude Desktop agent transcripts (`.jsonl`, one JSON
// object per line) and turns a week's worth of them into deterministic
// "how did I work with Claude" metrics: prompt volume, prompt length,
// how often prompts carried real context, tool/subagent usage, and the
// time-of-day distribution (so late-night prompting can be cross-linked
// with sleep in the weekly report).
//
// This module is pure Node (fs/path/os only) so it can run from a plain
// `.mjs` script without a build step. It NEVER sends transcript contents
// anywhere; only aggregate counts leave this file. If the transcript
// directories don't exist (e.g. running in CI/cloud), every function
// degrades gracefully to empty/zero results.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** yyyy-mm-dd (local) for a Date. */
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Default locations Cursor and Claude Desktop write transcripts to.
 * Overridable with the PENS_TRANSCRIPT_DIRS env var (comma-separated
 * absolute paths). Non-existent dirs are silently skipped.
 */
export function defaultTranscriptDirs() {
  const fromEnv = (process.env.PENS_TRANSCRIPT_DIRS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (fromEnv.length > 0) return fromEnv

  const home = homedir()
  return [
    join(home, '.cursor', 'projects'),
    join(home, '.claude', 'projects'),
  ]
}

/** Recursively collect every `.jsonl` file under the given directories. */
export function findTranscriptFiles(dirs = defaultTranscriptDirs()) {
  const out = []
  const seen = new Set()

  const walk = dir => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // unreadable / missing — skip
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (seen.has(full)) continue
      seen.add(full)
      try {
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          out.push(full)
        }
      } catch {
        // ignore individual entry errors
      }
    }
  }

  for (const dir of dirs) {
    if (dir && existsSync(dir)) walk(dir)
  }
  return out
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Parse a `<timestamp>` string like
 *   "Saturday, Jul 18, 2026, 6:46 AM (UTC+2)"
 * into the user's WALL-CLOCK components. We intentionally keep the
 * displayed local time (ignoring the UTC offset) because "late-night
 * prompting" is about the hour on the user's own clock.
 *
 * Returns { dateStr: 'yyyy-mm-dd', hour: 0-23 } or null if unparseable.
 */
export function parseTimestamp(raw) {
  if (!raw) return null
  const m = raw.match(
    /([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i,
  )
  if (!m) return null
  const monthKey = m[1].slice(0, 3).toLowerCase()
  const month = MONTHS[monthKey]
  if (month === undefined) return null
  const day = Number(m[2])
  const year = Number(m[3])
  let hour = Number(m[4])
  const minute = Number(m[5])
  const ampm = (m[6] || '').toUpperCase()
  if (ampm === 'PM' && hour < 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  if (Number.isNaN(day) || Number.isNaN(year) || Number.isNaN(hour)) return null

  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { dateStr, hour, minute }
}

/** Flatten a message `content` field (string | block[]) to plain text. */
function contentToText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(b => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
    .join('\n')
}

/** Names of tool-use blocks in a message content array. */
function toolUseNames(content) {
  if (!Array.isArray(content)) return []
  return content
    .filter(b => b && b.type === 'tool_use' && typeof b.name === 'string')
    .map(b => b.name)
}

const TIMESTAMP_RE = /<timestamp>([\s\S]*?)<\/timestamp>/
const USER_QUERY_RE = /<user_query>([\s\S]*?)<\/user_query>/

// A prompt is "context-rich" if it references files, pastes code, or uses
// explicit planning/constraint language — cheap proxies for a good prompt.
const CONTEXT_KEYWORDS =
  /\b(goal|constraint|must|should|acceptance|requirement|context|do not|don'?t|avoid|ensure|step[-\s]?by[-\s]?step|first|then|finally|because|so that|expected|instead)\b/i
const FILE_REF_RE = /(@[\w./-]+|\b[\w./-]+\.(ts|tsx|js|jsx|mjs|py|prisma|md|json|css|sql|sh)\b)/i
const CODE_FENCE_RE = /```|`[^`]+`/

/** Extract the meaningful user prompts from one transcript's raw text. */
export function parseTranscript(fileText) {
  const turns = []
  let toolUseCount = 0
  let subagentCount = 0

  const lines = fileText.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let obj
    try {
      obj = JSON.parse(trimmed)
    } catch {
      continue
    }

    const role = obj.role || obj.message?.role || obj.type
    const content = obj.message?.content ?? obj.content

    if (role === 'assistant') {
      const names = toolUseNames(content)
      toolUseCount += names.length
      subagentCount += names.filter(n => n === 'Task').length
      continue
    }

    if (role !== 'user') continue

    const text = contentToText(content)
    if (!text) continue

    // Skip tool_result / system-injected user turns that don't carry a
    // real prompt. Only genuine prompts have <user_query> or free text.
    const queryMatch = text.match(USER_QUERY_RE)
    const tsMatch = text.match(TIMESTAMP_RE)
    const promptText = queryMatch ? queryMatch[1].trim() : null

    // If there's no <user_query> wrapper, treat the whole text as a prompt
    // only when it's short-ish free text (avoids counting giant pasted
    // tool outputs). Transcripts from Cursor always wrap real prompts.
    const effectivePrompt =
      promptText ?? (text.length < 4000 && !text.includes('<system_reminder>') ? text.trim() : null)

    if (!effectivePrompt) continue

    const ts = tsMatch ? parseTimestamp(tsMatch[1]) : null

    turns.push({
      text: effectivePrompt,
      chars: effectivePrompt.length,
      words: effectivePrompt.split(/\s+/).filter(Boolean).length,
      contextRich:
        FILE_REF_RE.test(effectivePrompt) ||
        CODE_FENCE_RE.test(effectivePrompt) ||
        CONTEXT_KEYWORDS.test(effectivePrompt),
      dateStr: ts?.dateStr ?? null,
      hour: ts?.hour ?? null,
    })
  }

  return { turns, toolUseCount, subagentCount }
}

function median(nums) {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/**
 * Aggregate week metrics across every transcript file.
 *
 * @param {object} opts
 * @param {string[]} opts.files      absolute paths to `.jsonl` files
 * @param {string}   opts.weekStart  yyyy-mm-dd (inclusive)
 * @param {string}   opts.weekEnd    yyyy-mm-dd (inclusive)
 * @param {number}   [opts.maxSamplePrompts] how many prompt snippets to keep
 */
export function computeWeekMetrics({ files, weekStart, weekEnd, maxSamplePrompts = 12 }) {
  const inWindow = ts => ts && ts >= weekStart && ts <= weekEnd

  let sessions = 0
  let toolUseCount = 0
  let subagentCount = 0
  const promptChars = []
  const promptWords = []
  let contextRichCount = 0
  let lateNightPromptCount = 0
  let earlyMorningPromptCount = 0
  let undatedPromptCount = 0
  const byHour = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, 0]))
  const byDay = {}
  const samplePrompts = []
  let filesScanned = 0

  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    filesScanned++

    // Fallback date for turns that carry no <timestamp>: the file's last
    // modification time. Transcripts are effectively per-session, so this
    // maps an undated conversation to a single week instead of counting it
    // in EVERY week (which otherwise inflates weekly totals to all-time).
    let fallbackDate = null
    try {
      fallbackDate = toDateStr(statSync(file).mtime)
    } catch {
      /* keep null */
    }

    const { turns, toolUseCount: tu, subagentCount: su } = parseTranscript(text)

    // A turn belongs to the week if its own timestamp — or, when it has
    // none, the file's mtime — falls inside the window.
    const useTurns = turns.filter(t => {
      const d = t.dateStr ?? fallbackDate
      return d ? inWindow(d) : false
    })

    if (useTurns.length === 0) continue
    sessions++
    // Tool/subagent counts are file-level (assistant turns interleave), so we
    // only attribute them to the week when the file is active this week.
    toolUseCount += tu
    subagentCount += su

    for (const t of useTurns) {
      promptChars.push(t.chars)
      promptWords.push(t.words)
      if (t.contextRich) contextRichCount++
      if (t.hour == null) {
        undatedPromptCount++
      } else {
        byHour[t.hour]++
        if (t.hour >= 22 || t.hour < 5) lateNightPromptCount++
        if (t.hour >= 5 && t.hour < 9) earlyMorningPromptCount++
      }
      if (t.dateStr) byDay[t.dateStr] = (byDay[t.dateStr] || 0) + 1
      if (samplePrompts.length < maxSamplePrompts) {
        // Keep a short, redacted-length snippet for the LLM to critique.
        samplePrompts.push({
          chars: t.chars,
          words: t.words,
          contextRich: t.contextRich,
          hour: t.hour,
          snippet: t.text.length > 280 ? t.text.slice(0, 280) + '…' : t.text,
        })
      }
    }
  }

  const promptCount = promptChars.length
  const avg = arr => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)

  return {
    weekStart,
    weekEnd,
    filesScanned,
    sessions,
    promptCount,
    avgPromptChars: avg(promptChars),
    medianPromptChars: median(promptChars),
    avgPromptWords: avg(promptWords),
    longPromptCount: promptChars.filter(c => c >= 400).length,
    shortPromptCount: promptChars.filter(c => c < 60).length,
    contextRichCount,
    contextInclusionRate: promptCount ? Math.round((contextRichCount / promptCount) * 100) / 100 : 0,
    toolUseCount,
    subagentCount,
    toolUsePerPrompt: promptCount ? Math.round((toolUseCount / promptCount) * 10) / 10 : 0,
    lateNightPromptCount,
    earlyMorningPromptCount,
    undatedPromptCount,
    byHour,
    byDay,
    samplePrompts,
    available: filesScanned > 0 && promptCount > 0,
  }
}
