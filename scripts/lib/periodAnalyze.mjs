// =============================================================================
// Period Review Engine
//
// Advice is always relative to the window you are discussing.
// Example: 3 strong months followed by 9 weak months → a 12-month read is
// "bad" overall, while that opening 3-month stretch can still be named "good".
//
// Weekly Feedback must NOT pull this in as a substitute for an empty ISO week.
// Use `npm run analyze:periods` (or /period-review) for multi-horizon reads.
// =============================================================================

import { mondayOf, shiftDateStr, toDateStr, fromDateStr, weekBounds } from './weekDates.mjs'

const GOOD = 'good'
const MIXED = 'mixed'
const BAD = 'bad'

export function classifyScore(score) {
  if (score == null || Number.isNaN(score)) return null
  if (score >= 65) return GOOD
  if (score >= 45) return MIXED
  return BAD
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function avg(nums) {
  const a = nums.filter(n => typeof n === 'number' && !Number.isNaN(n))
  if (!a.length) return null
  return Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10
}

function daysBetween(a, b) {
  const ms = fromDateStr(b) - fromDateStr(a)
  return Math.round(ms / 86400000)
}

function monthsAgo(asOf, months) {
  const d = fromDateStr(asOf)
  d.setMonth(d.getMonth() - months)
  return toDateStr(d)
}

function inRange(date, from, to) {
  return date >= from && date <= to
}

/**
 * Build per-date signal bag from Garmin-ish rows.
 */
export function buildDailySignals(data) {
  const byDate = new Map()
  const touch = date => {
    if (!date) return null
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        sleepHours: null,
        sleepQuality: null,
        stress: null,
        hrv: null,
        restingHr: null,
        steps: null,
        bodyBatteryMax: null,
        activityMinutes: 0,
        activityCount: 0,
      })
    }
    return byDate.get(date)
  }

  for (const s of data.sleeps || []) {
    const row = touch(s.date)
    if (!row) continue
    if (typeof s.hours === 'number') row.sleepHours = s.hours
    if (typeof s.quality === 'number') row.sleepQuality = s.quality
  }
  for (const m of data.metrics || []) {
    const row = touch(m.date)
    if (!row || m.valueNum == null) continue
    if (m.kind === 'stress') row.stress = m.valueNum
    else if (m.kind === 'hrv') row.hrv = m.valueNum
    else if (m.kind === 'resting_hr') row.restingHr = m.valueNum
    else if (m.kind === 'steps') row.steps = m.valueNum
    else if (m.kind === 'body_battery_max') row.bodyBatteryMax = m.valueNum
  }
  for (const a of data.activities || []) {
    const row = touch(a.date)
    if (!row) continue
    row.activityCount += 1
    row.activityMinutes += Math.round((a.durationSec || 0) / 60)
  }

  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date))
}

/**
 * Score one day 0–100 from available signals. Missing domains are skipped
 * (score is renormalized), so sparse history still yields a usable read.
 */
export function scoreDay(day) {
  const parts = []
  if (day.sleepHours != null) {
    // 7.5h ideal; steep penalty below 6h
    const h = day.sleepHours
    let s = 100
    if (h >= 7 && h <= 8.5) s = 95
    else if (h >= 6.5) s = 75
    else if (h >= 6) s = 55
    else if (h >= 5) s = 35
    else s = 15
    parts.push(s)
  }
  if (day.stress != null) {
    // Lower stress is better
    const st = day.stress
    let s = 90
    if (st >= 60) s = 20
    else if (st >= 50) s = 35
    else if (st >= 40) s = 50
    else if (st >= 30) s = 70
    else s = 90
    parts.push(s)
  }
  if (day.hrv != null) {
    // Relative-friendly: treat mid values as ok; absolute scale varies by person.
    // Use a soft curve around 40–80 ms typical consumer wearables.
    const h = day.hrv
    let s = 60
    if (h >= 70) s = 90
    else if (h >= 55) s = 75
    else if (h >= 40) s = 55
    else if (h >= 30) s = 35
    else s = 20
    parts.push(s)
  }
  if (day.steps != null) {
    const st = day.steps
    let s = 40
    if (st >= 10000) s = 95
    else if (st >= 7500) s = 80
    else if (st >= 5000) s = 65
    else if (st >= 3000) s = 45
    else s = 25
    parts.push(s)
  }
  if (day.activityCount > 0) {
    // Presence of training is a mild positive; overdoing same day not scored here
    parts.push(clamp(50 + day.activityCount * 15 + Math.min(day.activityMinutes, 90) / 3, 50, 95))
  }
  if (!parts.length) return null
  return Math.round(avg(parts))
}

/**
 * Collapse daily scores into ISO weeks.
 */
export function buildWeeklyScores(daily) {
  const byWeek = new Map()
  for (const day of daily) {
    const score = scoreDay(day)
    if (score == null) continue
    const weekOf = mondayOf(day.date)
    if (!byWeek.has(weekOf)) {
      byWeek.set(weekOf, { weekOf, weekEnd: shiftDateStr(weekOf, 6), scores: [], days: 0 })
    }
    const w = byWeek.get(weekOf)
    w.scores.push(score)
    w.days += 1
  }
  return [...byWeek.values()]
    .map(w => {
      const score = avg(w.scores)
      return {
        weekOf: w.weekOf,
        weekEnd: w.weekEnd,
        days: w.days,
        score,
        verdict: classifyScore(score),
      }
    })
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
}

/**
 * Merge adjacent weeks with the same verdict into stretches.
 */
export function findSegments(weekly) {
  const segs = []
  for (const w of weekly) {
    if (!w.verdict) continue
    const last = segs[segs.length - 1]
    if (last && last.verdict === w.verdict) {
      last.weekEnd = w.weekEnd
      last.weeks += 1
      last.scores.push(w.score)
      last.days += w.days
    } else {
      segs.push({
        verdict: w.verdict,
        weekOf: w.weekOf,
        weekEnd: w.weekEnd,
        weeks: 1,
        days: w.days,
        scores: [w.score],
      })
    }
  }
  return segs.map(s => ({
    verdict: s.verdict,
    from: s.weekOf,
    to: s.weekEnd,
    weeks: s.weeks,
    approxMonths: Math.round((s.weeks / 4.345) * 10) / 10,
    avgScore: avg(s.scores),
    daysWithData: s.days,
  }))
}

function clipWeekly(weekly, from, to) {
  return weekly.filter(w => w.weekOf <= to && w.weekEnd >= from)
}

function clipSegments(segments, from, to) {
  const out = []
  for (const s of segments) {
    if (s.to < from || s.from > to) continue
    const cFrom = s.from < from ? from : s.from
    const cTo = s.to > to ? to : s.to
    const weeks = Math.max(1, Math.round(daysBetween(cFrom, cTo) / 7) + (cFrom === s.from && cTo === s.to ? 0 : 0))
    // Recompute weeks from Monday alignment when clipped
    let weekCount = 0
    let cursor = mondayOf(cFrom)
    while (cursor <= cTo) {
      weekCount++
      cursor = shiftDateStr(cursor, 7)
      if (weekCount > 80) break
    }
    out.push({
      ...s,
      from: cFrom,
      to: cTo,
      weeks: weekCount || s.weeks,
      approxMonths: Math.round(((weekCount || s.weeks) / 4.345) * 10) / 10,
      clipped: cFrom !== s.from || cTo !== s.to,
    })
  }
  return out
}

function horizonVerdict(weekly) {
  if (!weekly.length) {
    return { verdict: null, score: null, weeks: 0, goodWeeks: 0, badWeeks: 0, mixedWeeks: 0 }
  }
  const score = avg(weekly.map(w => w.score))
  const goodWeeks = weekly.filter(w => w.verdict === GOOD).length
  const badWeeks = weekly.filter(w => w.verdict === BAD).length
  const mixedWeeks = weekly.filter(w => w.verdict === MIXED).length
  // Duration-weighted: majority bad weeks → bad even if an early stretch was good
  let verdict = classifyScore(score)
  const badShare = badWeeks / weekly.length
  const goodShare = goodWeeks / weekly.length
  if (badShare >= 0.55) verdict = BAD
  else if (goodShare >= 0.55) verdict = GOOD
  else if (verdict == null) verdict = MIXED
  return { verdict, score, weeks: weekly.length, goodWeeks, badWeeks, mixedWeeks }
}

/**
 * Nested read: e.g. inside a 12m window, contrast a recent/early sub-stretch
 * against the remainder so "3m good + 9m bad" is explicit.
 */
export function nestedBreakdown(segmentsInHorizon, horizonLabel) {
  if (!segmentsInHorizon.length) return null
  if (segmentsInHorizon.length === 1) {
    const only = segmentsInHorizon[0]
    return {
      note: `Within ${horizonLabel}, the whole window reads as one ${only.verdict} stretch (${only.approxMonths} mo).`,
      parts: segmentsInHorizon,
    }
  }

  // Prefer the longest bad vs longest good contrast when both exist
  const goods = segmentsInHorizon.filter(s => s.verdict === GOOD)
  const bads = segmentsInHorizon.filter(s => s.verdict === BAD)
  const longestGood = goods.sort((a, b) => b.weeks - a.weeks)[0]
  const longestBad = bads.sort((a, b) => b.weeks - a.weeks)[0]

  const parts = segmentsInHorizon.map(s => ({
    verdict: s.verdict,
    from: s.from,
    to: s.to,
    weeks: s.weeks,
    approxMonths: s.approxMonths,
    avgScore: s.avgScore,
  }))

  let note
  if (longestGood && longestBad) {
    const order =
      longestGood.from < longestBad.from
        ? `a ${longestGood.approxMonths}-month ${GOOD} stretch, then a ${longestBad.approxMonths}-month ${BAD} stretch`
        : `a ${longestBad.approxMonths}-month ${BAD} stretch, then a ${longestGood.approxMonths}-month ${GOOD} stretch`
    note =
      `Within ${horizonLabel}: ${order}. ` +
      `If you only discuss the ${longestGood.approxMonths}-month good block, the advice is reinforcement. ` +
      `If you discuss the full ${horizonLabel}, the longer/weaker weight dominates — treat it as a ${longestBad.weeks >= longestGood.weeks ? BAD : 'mixed'} period overall.`
  } else {
    const labels = segmentsInHorizon.map(s => `${s.approxMonths}mo ${s.verdict}`).join(' → ')
    note = `Within ${horizonLabel} the pattern is: ${labels}. Advice must name which stretch you mean.`
  }

  return { note, parts, longestGood: longestGood || null, longestBad: longestBad || null }
}

function adviceForHorizon({ label, verdict, score, nested, weeks, coverageRatio }) {
  const advice = []
  if (verdict == null) {
    advice.push({
      period: label,
      kind: 'data',
      text: `No scored weeks in ${label} — import or sync data before asking for period advice.`,
    })
    return advice
  }

  advice.push({
    period: label,
    kind: 'verdict',
    text: `${label} verdict: ${verdict} (avg score ${score}/100 across ${weeks} weeks). Advice below applies to this window only.`,
  })

  if (coverageRatio != null && coverageRatio < 0.35) {
    advice.push({
      period: label,
      kind: 'caveat',
      text: `Sparse coverage in ${label} (${Math.round(coverageRatio * 100)}% of days) — treat the verdict as directional, not precise.`,
    })
  }

  if (nested?.longestGood && nested?.longestBad) {
    const g = nested.longestGood
    const b = nested.longestBad
    if (verdict === BAD || (b.weeks >= g.weeks && verdict !== GOOD)) {
      advice.push({
        period: label,
        kind: 'contrast',
        text:
          `Full ${label} read is not rescued by the ${g.approxMonths}-month good stretch (${g.from} → ${g.to}). ` +
          `Protect what worked there, but plan against the ${b.approxMonths}-month weak stretch (${b.from} → ${b.to}).`,
      })
      advice.push({
        period: `${g.from} → ${g.to}`,
        kind: 'stretch',
        text: `If discussing only the good stretch: keep the sleep/load habits from that block; do not average them away into the weak months.`,
      })
      advice.push({
        period: `${b.from} → ${b.to}`,
        kind: 'stretch',
        text: `If discussing only the weak stretch: cut late load, restore a fixed wind-down, and rebuild training consistency week by week.`,
      })
    } else if (verdict === GOOD) {
      advice.push({
        period: label,
        kind: 'contrast',
        text:
          `${label} is still a good period overall despite a ${b.approxMonths}-month dip (${b.from} → ${b.to}). ` +
          `Study the dip; do not let it rewrite the whole window.`,
      })
    } else {
      advice.push({
        period: label,
        kind: 'contrast',
        text: `${label} is mixed — name the stretch before giving advice. ${nested.note}`,
      })
    }
  } else if (verdict === GOOD) {
    advice.push({
      period: label,
      kind: 'action',
      text: `Hold the line for ${label}: keep sleep floor ≥7h and at least 3 active days/week so this stretch does not silently decay.`,
    })
  } else if (verdict === BAD) {
    advice.push({
      period: label,
      kind: 'action',
      text: `For ${label}: one metric first — sleep consistency — then reintroduce training volume. Do not judge progress on a single week inside a weak multi-month block.`,
    })
  } else {
    advice.push({
      period: label,
      kind: 'action',
      text: `${label} is mixed — pick the weakest domain (sleep, stress, or activity) and run a 4-week focus instead of changing everything.`,
    })
  }

  return advice
}

/**
 * @param {object} data - same shape as analyzeGarmin input (all-time load)
 * @param {object} opts
 * @param {string} [opts.asOf] - yyyy-mm-dd end of analysis (default: latest data or today)
 * @param {number[]} [opts.horizonsMonths] - e.g. [1,3,6,12]
 */
export function analyzePeriods(data, opts = {}) {
  const daily = buildDailySignals(data)
  const weeklyAll = buildWeeklyScores(daily)
  const segmentsAll = findSegments(weeklyAll)

  const dataFrom = daily[0]?.date || null
  const dataTo = daily[daily.length - 1]?.date || null
  const asOf = opts.asOf || dataTo || toDateStr(new Date())
  const horizonsMonths = opts.horizonsMonths || [1, 3, 6, 12]

  const horizons = []
  for (const months of horizonsMonths) {
    const from = monthsAgo(asOf, months)
    const to = asOf
    const label = `last ${months} month${months === 1 ? '' : 's'}`
    const weekly = clipWeekly(weeklyAll, from, to)
    const segments = clipSegments(segmentsAll, from, to)
    const stats = horizonVerdict(weekly)
    const nested = nestedBreakdown(segments, label)
    const expectedDays = Math.max(1, daysBetween(from, to) + 1)
    const daysWithData = weekly.reduce((s, w) => s + w.days, 0)
    const coverageRatio = daysWithData / expectedDays
    const advice = adviceForHorizon({
      label,
      verdict: stats.verdict,
      score: stats.score,
      nested,
      weeks: stats.weeks,
      coverageRatio,
    })

    horizons.push({
      label,
      months,
      from,
      to,
      ...stats,
      coverageRatio: Math.round(coverageRatio * 100) / 100,
      segments,
      nested,
      advice,
    })
  }

  // All-history horizon (not month-capped)
  if (dataFrom && dataTo) {
    const label = 'all available history'
    const stats = horizonVerdict(weeklyAll)
    const nested = nestedBreakdown(segmentsAll, label)
    const advice = adviceForHorizon({
      label,
      verdict: stats.verdict,
      score: stats.score,
      nested,
      weeks: stats.weeks,
      coverageRatio: null,
    })
    horizons.push({
      label,
      months: null,
      from: dataFrom,
      to: dataTo,
      ...stats,
      coverageRatio: null,
      segments: segmentsAll,
      nested,
      advice,
    })
  }

  const h12 = horizons.find(h => h.months === 12)
  const headlineParts = []
  if (h12?.verdict) {
    headlineParts.push(`On a 12-month view: ${h12.verdict} (score ${h12.score}/100).`)
    if (h12.nested?.longestGood && h12.nested?.longestBad) {
      headlineParts.push(
        `Inside that window: ${h12.nested.longestGood.approxMonths}mo good vs ${h12.nested.longestBad.approxMonths}mo bad — discuss the stretch, not a single blended slogan.`,
      )
    }
  } else if (segmentsAll.length) {
    const last = segmentsAll[segmentsAll.length - 1]
    headlineParts.push(`Latest stretch is ${last.verdict} (${last.from} → ${last.to}, ~${last.approxMonths} mo).`)
  } else {
    headlineParts.push('Not enough Garmin/health rows to build period advice yet.')
  }

  return {
    asOf,
    dataSpan: { from: dataFrom, to: dataTo },
    weeklyCount: weeklyAll.length,
    segments: segmentsAll,
    horizons,
    headline: headlineParts.join(' '),
  }
}

/**
 * Render a markdown report for docs/reports.
 */
export function periodsToMarkdown(report) {
  const lines = [
    '# Period Review',
    '',
    `_As of ${report.asOf} · data ${report.dataSpan.from || '—'} → ${report.dataSpan.to || '—'}_`,
    '',
    '## Headline',
    report.headline,
    '',
    '## How to use this',
    '- Weekly Feedback = this ISO week only. Do not paste archive periods into that overview.',
    '- Period Review = multi-month advice. Always name the window (3m / 12m / a specific stretch).',
    '- A good 3-month stretch inside a weak 12-month window stays "good" when discussed alone; the 12-month verdict can still be "bad".',
    '',
    '## Stretches (all history)',
  ]
  if (!report.segments.length) {
    lines.push('_none_')
  } else {
    for (const s of report.segments) {
      lines.push(
        `- **${s.verdict}** · ${s.from} → ${s.to} · ~${s.approxMonths} mo (${s.weeks} weeks, avg ${s.avgScore}/100)`,
      )
    }
  }
  lines.push('')

  for (const h of report.horizons) {
    lines.push(`## ${h.label}`)
    lines.push('')
    if (!h.verdict) {
      lines.push('_No scored weeks in this window._')
      lines.push('')
      continue
    }
    lines.push(
      `**Verdict:** ${h.verdict} · score ${h.score}/100 · ${h.weeks} weeks` +
        ` (${h.goodWeeks} good / ${h.mixedWeeks} mixed / ${h.badWeeks} bad)` +
        (h.coverageRatio != null ? ` · coverage ${Math.round(h.coverageRatio * 100)}%` : ''),
    )
    lines.push('')
    if (h.nested?.note) {
      lines.push(h.nested.note)
      lines.push('')
    }
    if (h.segments?.length) {
      lines.push('Stretches in window:')
      for (const s of h.segments) {
        lines.push(`- ${s.verdict}: ${s.from} → ${s.to} (~${s.approxMonths} mo)`)
      }
      lines.push('')
    }
    lines.push('Advice (scoped to this period):')
    for (const a of h.advice || []) {
      lines.push(`- *(${a.period})* ${a.text}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export { GOOD, MIXED, BAD, weekBounds }
