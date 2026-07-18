// Reads the Claude Desktop "scheduled Feedback" archive for ISZE /
// professional work. Source of truth stays in that folder; MY PENS only
// ingests a short summary + open loops into the weekly report.
//
// Expected layout (user path):
//   C:\Users\jerom\Desktop\claude\ISZE\05_memory\briefs\feedback_history\
//     00_INDEX.md
//     Feedback_Jerome_YYYY-MM-DD.md   (or similar)
//
// Override with env PENS_ISZE_FEEDBACK_DIR.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_DIR =
  process.env.PENS_ISZE_FEEDBACK_DIR?.trim() ||
  join(
    process.env.USERPROFILE || process.env.HOME || '',
    'Desktop',
    'claude',
    'ISZE',
    '05_memory',
    'briefs',
    'feedback_history',
  )

export function defaultIszeFeedbackDir() {
  return DEFAULT_DIR
}

function listMarkdown(dir) {
  try {
    return readdirSync(dir)
      .filter(n => n.toLowerCase().endsWith('.md'))
      .map(n => {
        const full = join(dir, n)
        let mtime = 0
        try {
          mtime = statSync(full).mtimeMs
        } catch {
          /* ignore */
        }
        return { name: n, full, mtime }
      })
  } catch {
    return []
  }
}

/** Pull a short TL;DR / summary block from markdown. */
function extractSummary(md) {
  if (!md) return ''
  // Prefer an explicit TL;DR / Summary heading.
  const tldr = md.match(
    /(?:^|\n)#{1,3}\s*(?:TL;?DR|Summary|The week|Headline)[^\n]*\n+([\s\S]{40,900}?)(?=\n#{1,3}\s|\n---|\n\*\*|$)/i,
  )
  if (tldr) return tldr[1].replace(/\s+/g, ' ').trim().slice(0, 800)

  // Fall back to first substantial paragraph.
  const paras = md
    .split(/\n\s*\n/)
    .map(p => p.replace(/^#+\s.*/, '').replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 60 && !p.startsWith('```'))
  return (paras[0] || md.replace(/\s+/g, ' ').trim()).slice(0, 800)
}

/** Heuristic open-loop extraction — recurring items called out as still open. */
function extractOpenLoops(md, indexMd) {
  const text = `${indexMd || ''}\n${md || ''}`
  const loops = []
  const patterns = [
    /CLAUDE\.md\s+staleness[^\n.]{0,120}/gi,
    /(?:still|still open|unfixed|not (?:yet )?fixed|awaiting|never (?:actually )?resolved)[^\n.]{0,140}/gi,
    /(?:oil filter\s*%|lubricants margin|AIM status|UIO version)[^\n.]{0,80}/gi,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) != null) {
      const s = m[0].replace(/\s+/g, ' ').trim()
      if (s.length > 12 && !loops.some(x => x.toLowerCase() === s.toLowerCase())) {
        loops.push(s)
      }
      if (loops.length >= 6) break
    }
    if (loops.length >= 6) break
  }
  return loops.slice(0, 6)
}

/**
 * Load the latest ISZE scheduled-Feedback brief for a given week window.
 * Prefer a file whose name/date falls in [weekOf, weekEnd]; else newest file.
 */
export function loadIszeFeedback({
  dir = defaultIszeFeedbackDir(),
  weekOf,
  weekEnd,
} = {}) {
  if (!dir || !existsSync(dir)) {
    return {
      available: false,
      dir: dir || null,
      reason: 'directory_missing',
    }
  }

  const files = listMarkdown(dir)
  const indexFile = files.find(f => /^00_index\.md$/i.test(f.name))
  let indexMd = ''
  if (indexFile) {
    try {
      indexMd = readFileSync(indexFile.full, 'utf8')
    } catch {
      indexMd = ''
    }
  }

  const briefs = files.filter(f => !/^00_index\.md$/i.test(f.name))
  if (briefs.length === 0) {
    return {
      available: false,
      dir,
      indexPath: indexFile?.full ?? null,
      reason: 'no_briefs',
      runCount: 0,
    }
  }

  // Prefer filename date inside the week window.
  const dated = briefs.map(f => {
    const m = f.name.match(/(\d{4}-\d{2}-\d{2})/)
    return { ...f, dateStr: m ? m[1] : null }
  })

  let chosen =
    dated.find(f => f.dateStr && weekOf && weekEnd && f.dateStr >= weekOf && f.dateStr <= weekEnd) ||
    null

  if (!chosen) {
    // Newest by mtime, then by date in name.
    chosen = [...dated].sort((a, b) => {
      if (a.dateStr && b.dateStr && a.dateStr !== b.dateStr) return b.dateStr.localeCompare(a.dateStr)
      return b.mtime - a.mtime
    })[0]
  }

  let body = ''
  try {
    body = readFileSync(chosen.full, 'utf8')
  } catch {
    return { available: false, dir, reason: 'read_failed', latestFile: chosen.full }
  }

  const summary = extractSummary(body) || extractSummary(indexMd)
  const openLoops = extractOpenLoops(body, indexMd)
  const qualityMatch = body.match(/quality\s*[:=]\s*([^\n]+)/i)

  return {
    available: Boolean(summary || body),
    dir,
    indexPath: indexFile?.full ?? null,
    latestFile: chosen.full,
    latestName: chosen.name,
    latestDate: chosen.dateStr,
    runCount: briefs.length,
    qualityNote: qualityMatch ? qualityMatch[1].trim() : null,
    summary,
    openLoops,
    // Keep a bounded excerpt for the LLM / UI — not the whole archive.
    excerpt: body.slice(0, 3500),
  }
}
