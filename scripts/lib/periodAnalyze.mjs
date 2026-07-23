// =============================================================================
// Period Review Engine (deep)
//
// Advice is always relative to the window you are discussing.
// Example: 3 strong months followed by 9 weak months → a 12-month read is
// "bad" overall, while that opening 3-month stretch can still be named "good".
//
// Deep mode compares sleep · stress · HRV · resting HR · steps · activities
// against each other (correlations + pattern reads + long-form narrative).
//
// Weekly Feedback must NOT pull this in as a substitute for an empty ISO week.
// =============================================================================

import { mondayOf, shiftDateStr, toDateStr, fromDateStr, weekBounds } from './weekDates.mjs'
import { analyzeCausal } from './periodCausal.mjs'
import { esc, reportCss, friendlyCausal } from './reportHtml.mjs'
import { dayTrainingLoad } from './trainingLoad.mjs'

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

function median(nums) {
  const a = nums.filter(n => typeof n === 'number' && !Number.isNaN(n)).sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : Math.round(((a[m - 1] + a[m]) / 2) * 10) / 10
}

function min(nums) {
  const a = nums.filter(n => typeof n === 'number' && !Number.isNaN(n))
  return a.length ? Math.min(...a) : null
}

function max(nums) {
  const a = nums.filter(n => typeof n === 'number' && !Number.isNaN(n))
  return a.length ? Math.max(...a) : null
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

function trend(nums) {
  if (!nums || nums.length < 4) return 'unknown'
  const mid = Math.floor(nums.length / 2)
  const a = avg(nums.slice(0, mid))
  const b = avg(nums.slice(mid))
  if (a == null || b == null) return 'unknown'
  const delta = b - a
  const thresh = Math.max(Math.abs(a) * 0.05, 0.5)
  if (delta > thresh) return 'up'
  if (delta < -thresh) return 'down'
  return 'flat'
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 5) return null
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0,
    c = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i],
      y = ys[i]
    if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) continue
    c++
    sx += x
    sy += y
    sxx += x * x
    syy += y * y
    sxy += x * y
  }
  if (c < 5) return null
  const num = c * sxy - sx * sy
  const den = Math.sqrt((c * sxx - sx * sx) * (c * syy - sy * sy))
  if (!den) return null
  return Math.round((num / den) * 100) / 100
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
        trainingLoad: 0,
        hardLoad: 0,
        easyLoad: 0,
      })
    }
    return byDate.get(date)
  }

  for (const s of data.sleeps || []) {
    const row = touch(s.date)
    if (!row) continue
    if (typeof s.hours === 'number') row.sleepHours = s.hours
    if (typeof s.quality === 'number') row.sleepQuality = s.quality
    // SleepEntry.hrv (avgSleepingHRV from dump) — use when daily metric HRV is missing
    if (typeof s.hrv === 'number' && s.hrv > 0 && row.hrv == null) row.hrv = s.hrv
  }
  for (const m of data.metrics || []) {
    const row = touch(m.date)
    if (!row || m.valueNum == null) continue
    const kind = String(m.kind || '')
      .toLowerCase()
      .trim()
    if (kind === 'stress' || kind === 'stress_avg' || kind === 'average_stress') {
      row.stress = m.valueNum
    } else if (kind === 'hrv' || kind === 'hrv_rmssd' || kind === 'sleeping_hrv') {
      row.hrv = m.valueNum
    } else if (kind === 'resting_hr' || kind === 'rhr' || kind === 'resting_heart_rate') {
      row.restingHr = m.valueNum
    } else if (kind === 'steps' || kind === 'total_steps') {
      row.steps = m.valueNum
    } else if (kind === 'body_battery_max' || kind === 'body_battery') {
      row.bodyBatteryMax = m.valueNum
    }
  }

  // Group activities / trainings by date, then score with intensity-weighted PLU
  /** @type {Map<string, any[]>} */
  const actsByDate = new Map()
  /** @type {Map<string, any[]>} */
  const trainsByDate = new Map()
  for (const a of data.activities || []) {
    if (!a?.date) continue
    if (!actsByDate.has(a.date)) actsByDate.set(a.date, [])
    actsByDate.get(a.date).push(a)
    touch(a.date)
  }
  for (const t of data.trainings || []) {
    if (!t?.date) continue
    if (!trainsByDate.has(t.date)) trainsByDate.set(t.date, [])
    trainsByDate.get(t.date).push(t)
    touch(t.date)
  }

  const allLoadDates = new Set([...actsByDate.keys(), ...trainsByDate.keys()])
  for (const date of allLoadDates) {
    const row = touch(date)
    if (!row) continue
    const acts = actsByDate.get(date) || []
    const trains = trainsByDate.get(date) || []
    const scored = dayTrainingLoad(acts, trains, {
      restingHr: row.restingHr ?? 50,
      hrMax: 185,
    })
    row.activityCount = acts.length + trains.length
    row.activityMinutes = scored.activityMinutes
    row.trainingLoad = scored.trainingLoad
    row.hardLoad = scored.hardLoad
    row.easyLoad = scored.easyLoad
  }

  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date))
}

export function scoreDay(day) {
  const parts = []
  if (day.sleepHours != null) {
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
    // Prefer intensity-weighted load (PLU) so long walks don't inflate Form
    const load = day.trainingLoad != null ? day.trainingLoad : day.activityMinutes
    parts.push(clamp(50 + day.activityCount * 12 + Math.min(load, 120) / 2.5, 50, 95))
  }
  if (!parts.length) return null
  return Math.round(avg(parts))
}

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

function clipDaily(daily, from, to) {
  return daily.filter(d => d.date >= from && d.date <= to)
}

function clipSegments(segments, from, to) {
  const out = []
  for (const s of segments) {
    if (s.to < from || s.from > to) continue
    const cFrom = s.from < from ? from : s.from
    const cTo = s.to > to ? to : s.to
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
  let verdict = classifyScore(score)
  const badShare = badWeeks / weekly.length
  const goodShare = goodWeeks / weekly.length
  if (badShare >= 0.55) verdict = BAD
  else if (goodShare >= 0.55) verdict = GOOD
  else if (verdict == null) verdict = MIXED
  return { verdict, score, weeks: weekly.length, goodWeeks, badWeeks, mixedWeeks }
}

export function nestedBreakdown(segmentsInHorizon, horizonLabel) {
  if (!segmentsInHorizon.length) return null
  if (segmentsInHorizon.length === 1) {
    const only = segmentsInHorizon[0]
    return {
      note: `Within ${horizonLabel}, the whole window reads as one ${only.verdict} stretch (${only.approxMonths} mo).`,
      parts: segmentsInHorizon,
    }
  }

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

// ---------------------------------------------------------------------------
// Deep domain + cross-metric engine
// ---------------------------------------------------------------------------

function series(daily, key) {
  const dates = []
  const values = []
  for (const d of daily) {
    const v = d[key]
    if (v == null || Number.isNaN(v)) continue
    dates.push(d.date)
    values.push(v)
  }
  return { dates, values }
}

function paired(a, b) {
  const mapB = new Map(b.dates.map((d, i) => [d, b.values[i]]))
  const xs = []
  const ys = []
  for (let i = 0; i < a.dates.length; i++) {
    if (!mapB.has(a.dates[i])) continue
    xs.push(a.values[i])
    ys.push(mapB.get(a.dates[i]))
  }
  return { xs, ys, n: xs.length }
}

/**
 * Per-domain stats for a clipped daily window.
 */
export function domainStats(daily) {
  const sleepH = daily.map(d => d.sleepHours).filter(v => v != null)
  const stress = daily.map(d => d.stress).filter(v => v != null)
  const hrv = daily.map(d => d.hrv).filter(v => v != null)
  const rhr = daily.map(d => d.restingHr).filter(v => v != null)
  const steps = daily.map(d => d.steps).filter(v => v != null)
  const bb = daily.map(d => d.bodyBatteryMax).filter(v => v != null)
  const activeDays = daily.filter(d => d.activityCount > 0)
  const totalActMin = daily.reduce((s, d) => s + (d.activityMinutes || 0), 0)
  const totalSessions = daily.reduce((s, d) => s + (d.activityCount || 0), 0)
  const zeroActivityDays = daily.filter(d => (d.activityCount || 0) === 0).length
  const latestRhr = [...daily].reverse().find(d => d.restingHr != null)?.restingHr ?? null
  const latestSleep = [...daily].reverse().find(d => d.sleepHours != null)?.sleepHours ?? null

  return {
    sleep: sleepH.length
      ? {
          days: sleepH.length,
          avgHours: avg(sleepH),
          medianHours: median(sleepH),
          minHours: min(sleepH),
          maxHours: max(sleepH),
          shortNights: sleepH.filter(h => h < 6.5).length,
          trend: trend(sleepH),
          latestHours: latestSleep,
        }
      : null,
    stress: stress.length
      ? {
          days: stress.length,
          avg: avg(stress),
          median: median(stress),
          max: max(stress),
          highDays: stress.filter(v => v >= 50).length,
          trend: trend(stress),
        }
      : null,
    hrv: hrv.length
      ? {
          days: hrv.length,
          avg: avg(hrv),
          median: median(hrv),
          min: min(hrv),
          max: max(hrv),
          trend: trend(hrv),
        }
      : null,
    restingHr: rhr.length
      ? {
          days: rhr.length,
          avg: avg(rhr),
          median: median(rhr),
          min: min(rhr),
          max: max(rhr),
          trend: trend(rhr),
          latest: latestRhr,
        }
      : null,
    steps: steps.length
      ? {
          days: steps.length,
          avg: avg(steps),
          median: median(steps),
          lowDays: steps.filter(v => v < 5000).length,
          trend: trend(steps),
        }
      : null,
    bodyBattery: bb.length
      ? {
          days: bb.length,
          avgMax: avg(bb),
          trend: trend(bb),
        }
      : null,
    activity: {
      daysInWindow: daily.length,
      activeDays: activeDays.length,
      sessions: totalSessions,
      totalMinutes: totalActMin,
      avgMinutesPerDay: daily.length ? Math.round(totalActMin / daily.length) : 0,
      zeroActivityDays,
      zeroActivityShare: daily.length ? Math.round((zeroActivityDays / daily.length) * 100) / 100 : null,
    },
  }
}

/**
 * Pairwise correlations across all primary metrics.
 */
export function crossMetricMatrix(daily) {
  const keys = [
    ['sleepHours', 'sleep'],
    ['stress', 'stress'],
    ['hrv', 'hrv'],
    ['restingHr', 'restingHr'],
    ['steps', 'steps'],
    ['bodyBatteryMax', 'bodyBattery'],
    ['activityMinutes', 'activityMinutes'],
  ]
  const seriesMap = {}
  for (const [field, label] of keys) {
    seriesMap[label] = series(daily, field)
  }

  const pairs = []
  const labels = keys.map(k => k[1])
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]
      const b = labels[j]
      const { xs, ys, n } = paired(seriesMap[a], seriesMap[b])
      const r = pearson(xs, ys)
      if (r == null) continue
      pairs.push({ a, b, r, n, strength: Math.abs(r) >= 0.4 ? 'strong' : Math.abs(r) >= 0.25 ? 'moderate' : 'weak' })
    }
  }
  pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
  return pairs
}

function describeCorr(pair) {
  const { a, b, r, strength } = pair
  const dir = r > 0 ? 'rise together' : 'move opposite'
  return `${a} ↔ ${b}: r=${r} (${strength}, ${dir})`
}

/**
 * Pattern library — the “what happened?” layer.
 * When causal.alcohol binge evidence exists, alcohol patterns win over idle-RHR.
 */
export function interpretPatterns(domains, cross, daily, causal = null) {
  const patterns = []
  const act = domains.activity
  const rhr = domains.restingHr
  const hrv = domains.hrv
  const stress = domains.stress
  const sleep = domains.sleep
  const steps = domains.steps

  const corr = (a, b) => cross.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))

  const alcoholDominant =
    causal?.topHypothesis?.id === 'alcohol_binge_stack' ||
    causal?.topHypothesis?.id === 'rhr_heavy_stack' ||
    (causal?.alcohol?.maxDrinks ?? 0) >= 10 ||
    (causal?.alcohol?.bingeDays ?? 0) > 0

  // Causal patterns first (alcohol, lag mismatch, …)
  if (causal?.patterns?.length) {
    for (const p of causal.patterns) patterns.push(p)
  }

  // --- Low RHR + no / low activity (demoted when alcohol explains it) ---
  const latestRhr = rhr?.latest ?? rhr?.avg
  const noActivity =
    act &&
    (act.sessions === 0 ||
      (act.zeroActivityShare != null && act.zeroActivityShare >= 0.85) ||
      act.activeDays === 0)
  const lowRhr = latestRhr != null && latestRhr <= 56

  if (lowRhr && noActivity && !alcoholDominant) {
    const stepsLow = steps && steps.avg != null && steps.avg < 5000
    const stressOk = !stress || stress.avg == null || stress.avg < 40
    const hrvOk = !hrv || hrv.avg == null || hrv.avg >= 40

    patterns.push({
      id: 'low_rhr_no_activity',
      severity: 'high',
      title: `Resting HR ~${Math.round(latestRhr)} with almost no logged activity`,
      text:
        `Night / resting HR around ${Math.round(latestRhr)} bpm looks “fit” on its own — but in this window you logged ` +
        `${act.sessions} structured session(s) across ${act.daysInWindow} days ` +
        `(${Math.round((act.zeroActivityShare || 0) * 100)}% zero-activity days` +
        (steps ? `, steps ~${Math.round(steps.avg)}/day` : '') +
        `). ` +
        `No binge-scale Anchor drinks in this window, so the default read is under-loading / recovery illusion. ` +
        `If you actually drank heavily and did not log it, log alcoholDrinks on Anchor — 15 beers changes the diagnosis. ` +
        (stepsLow
          ? `Steps are also soft — sedentary calm, not performance calm. `
          : '') +
        (stressOk && hrvOk ? `Stress/HRV look unstressed, which fits idle. ` : '') +
        `Reintroduce easy aerobic work 3×/week before trusting this RHR as a fitness badge.`,
    })
  } else if (lowRhr && act && act.sessions > 0) {
    patterns.push({
      id: 'low_rhr_with_training',
      severity: 'info',
      title: `Resting HR ~${Math.round(latestRhr)} with training present`,
      text:
        `RHR around ${Math.round(latestRhr)} with ${act.sessions} sessions in-window is consistent with aerobic fitness ` +
        `or good recovery — only trust it if HRV is stable/up and stress is not climbing.`,
    })
  } else if (rhr && rhr.latest != null && rhr.latest >= 65 && noActivity) {
    patterns.push({
      id: 'elevated_rhr_idle',
      severity: 'high',
      title: `Elevated resting HR (${Math.round(rhr.latest)}) while idle`,
      text:
        `RHR ${Math.round(rhr.latest)} without training load is a redder flag than a low RHR idle state — possible ` +
        `poor sleep, illness, alcohol, or autonomic stress. Do not add hard sessions until RHR settles.`,
    })
  }

  // Rising RHR vs falling HRV
  if (rhr?.trend === 'up' && hrv?.trend === 'down') {
    patterns.push({
      id: 'rhr_up_hrv_down',
      severity: 'high',
      title: 'Resting HR rising while HRV falls',
      text:
        `Classic under-recovery couple: RHR trend up + HRV trend down. Cut intensity for 7–10 days; protect sleep. ` +
        `This overrides a “good” composite score if the window is recent.`,
    })
  }

  // Stress vs sleep
  const stressSleep = corr('stress', 'sleep')
  if (stressSleep && stressSleep.r <= -0.3) {
    patterns.push({
      id: 'stress_cuts_sleep',
      severity: 'high',
      title: 'Higher stress tracks with shorter sleep',
      text:
        `Correlation stress↔sleep hours r=${stressSleep.r} (n=${stressSleep.n}). When stress rises, nights shorten. ` +
        `Treat evening load (work, late prompts, alcohol) as a sleep intervention, not a separate problem.`,
    })
  }

  // HRV vs sleep
  const hrvSleep = corr('hrv', 'sleep')
  if (hrvSleep && hrvSleep.r >= 0.25) {
    patterns.push({
      id: 'sleep_lifts_hrv',
      severity: 'info',
      title: 'Longer sleep links to higher HRV',
      text:
        `HRV↔sleep r=${hrvSleep.r}. Sleep length is a lever for recovery capacity in this dataset — worth defending ` +
        `before adding more training volume.`,
    })
  }

  // HRV vs stress
  const hrvStress = corr('hrv', 'stress')
  if (hrvStress && hrvStress.r <= -0.25) {
    patterns.push({
      id: 'hrv_vs_stress',
      severity: 'info',
      title: 'HRV drops when stress rises',
      text: `Expected inverse link (r=${hrvStress.r}). Use HRV as a brake when stress averages stay elevated.`,
    })
  }

  // Activity vs RHR
  const actRhr = corr('activityMinutes', 'restingHr')
  if (actRhr && actRhr.r <= -0.25) {
    patterns.push({
      id: 'training_lowers_rhr',
      severity: 'info',
      title: 'More activity minutes track with lower resting HR',
      text:
        `activityMinutes↔restingHr r=${actRhr.r}. In windows where you actually train, RHR tends to sit lower — ` +
        `another reason idle-low-RHR should not be confused with trained-low-RHR.`,
    })
  }

  // Steps vs sleep
  const stepsSleep = corr('steps', 'sleep')
  if (stepsSleep && stepsSleep.r <= -0.25) {
    patterns.push({
      id: 'high_steps_short_sleep',
      severity: 'moderate',
      title: 'Higher steps track with shorter sleep',
      text:
        `steps↔sleep r=${stepsSleep.r}. Possible late-day load or overreaching on feet. Cap late walks / stand hours ` +
        `when sleep is already short.`,
    })
  }

  // High composite from sleep alone while activity dead
  if (sleep && sleep.avgHours >= 7 && noActivity) {
    patterns.push({
      id: 'sleep_props_score',
      severity: 'moderate',
      title: 'Composite score propped up by sleep while training is absent',
      text:
        `Sleep averages ${sleep.avgHours}h, which can make the period look “good” even with zero sessions. ` +
        `That is a recovery score, not a training score. Name the domain before celebrating the window.`,
    })
  }

  // Short sleep + high stress
  if (sleep && sleep.avgHours < 6.5 && stress && stress.avg >= 40) {
    patterns.push({
      id: 'short_sleep_high_stress',
      severity: 'high',
      title: 'Short sleep stacked with elevated stress',
      text:
        `Sleep avg ${sleep.avgHours}h with stress avg ${stress.avg}. This pair compounds: protect a fixed wind-down ` +
        `before any performance goal.`,
    })
  }

  // Body battery vs stress
  const bbStress = corr('bodyBattery', 'stress')
  if (bbStress && bbStress.r <= -0.25) {
    patterns.push({
      id: 'bb_vs_stress',
      severity: 'info',
      title: 'Body battery falls as stress rises',
      text: `bodyBattery↔stress r=${bbStress.r}. Expected. Use body-battery lows as a same-day intensity veto.`,
    })
  }

  // Recent days deep dive (last 7 with data)
  const recent = daily.slice(-7)
  if (recent.length >= 3) {
    const rRecent = avg(recent.map(d => d.restingHr).filter(v => v != null))
    const aRecent = recent.reduce((s, d) => s + d.activityCount, 0)
    const sRecent = avg(recent.map(d => d.sleepHours).filter(v => v != null))
    if (rRecent != null && rRecent <= 56 && aRecent === 0) {
      patterns.push({
        id: 'recent_rhr_idle',
        severity: 'high',
        title: `Last ${recent.length} days: RHR ~${Math.round(rRecent)}, zero sessions`,
        text:
          `Most recent slice: resting HR ~${Math.round(rRecent)}` +
          (sRecent != null ? `, sleep ~${sRecent}h` : '') +
          `, structured activity = 0. ` +
          `Nothing “mysterious” happened — the watch is reporting a quiet autonomic state because you did not load. ` +
          `If the question is “am I getting fitter?”: not from this week. If the question is “am I recovered enough to train?”: ` +
          `yes, start easy; the low RHR is permission, not a medal.`,
      })
    }
  }

  // Sort: high first
  const rank = { high: 0, moderate: 1, info: 2 }
  patterns.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
  return patterns
}

/**
 * Long-form narrative for a horizon — this is the “text” the UI must show.
 */
export function buildDeepNarrative({ label, verdict, score, weeks, domains, cross, patterns, nested, causal }) {
  const paras = []

  paras.push(
    `Period under discussion: ${label}. Verdict ${verdict ?? 'n/a'}` +
      (score != null ? ` at ${score}/100 across ${weeks} weeks` : '') +
      `. Everything below applies only to this window.`,
  )

  if (causal?.narrative) {
    paras.push(causal.narrative)
  }

  // Domain paragraph
  const bits = []
  if (domains.sleep) {
    bits.push(
      `sleep ${domains.sleep.avgHours}h avg (${domains.sleep.shortNights} nights <6.5h, trend ${domains.sleep.trend})`,
    )
  }
  if (domains.stress) {
    bits.push(`stress avg ${domains.stress.avg} (${domains.stress.highDays} high days, trend ${domains.stress.trend})`)
  }
  if (domains.hrv) {
    bits.push(`HRV avg ${domains.hrv.avg} (trend ${domains.hrv.trend})`)
  }
  if (domains.restingHr) {
    bits.push(
      `resting HR avg ${domains.restingHr.avg} / latest ${domains.restingHr.latest ?? '—'} (trend ${domains.restingHr.trend})`,
    )
  }
  if (domains.steps) {
    bits.push(`steps ~${Math.round(domains.steps.avg)}/d (${domains.steps.lowDays} low days)`)
  }
  if (domains.activity) {
    bits.push(
      `activities ${domains.activity.sessions} sessions / ${domains.activity.activeDays} active days` +
        ` (${Math.round((domains.activity.zeroActivityShare || 0) * 100)}% idle days)`,
    )
  }
  if (bits.length) {
    paras.push(`Domain stack: ${bits.join('; ')}.`)
  } else {
    paras.push('Domain stack: almost no overlapping metrics in this window — import more Garmin rows.')
  }

  if (nested?.note) paras.push(nested.note)

  // Cross-metric paragraph
  const strong = (cross || []).filter(p => p.strength !== 'weak').slice(0, 8)
  if (strong.length) {
    paras.push(
      `Cross-metric links (strongest first): ${strong.map(describeCorr).join('; ')}. ` +
        `Weak links are omitted; they are noise at this sample size.`,
    )
  } else {
    paras.push(
      'Cross-metric links: not enough overlapping days to trust correlations yet (need ≥5 paired days per pair).',
    )
  }

  // Pattern narratives
  const highs = (patterns || []).filter(p => p.severity === 'high')
  const rest = (patterns || []).filter(p => p.severity !== 'high')
  for (const p of highs) {
    paras.push(`${p.title}. ${p.text}`)
  }
  for (const p of rest.slice(0, 4)) {
    paras.push(`${p.title}. ${p.text}`)
  }

  if (!patterns?.length) {
    paras.push('No sharp cross-metric conflict patterns fired in this window — keep logging so contrasts can emerge.')
  }

  return paras.join('\n\n')
}

function adviceForHorizon({ label, verdict, score, nested, weeks, coverageRatio, patterns, domains, causal }) {
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

  if (causal?.topHypothesis) {
    advice.push({
      period: label,
      kind: 'causal',
      text: `Leading explanation (${Math.round(causal.topHypothesis.confidence * 100)}%): ${causal.topHypothesis.label}. ${causal.topHypothesis.text}`,
    })
  }

  // Pattern-driven actions first
  for (const p of (patterns || []).filter(x => x.severity === 'high').slice(0, 3)) {
    advice.push({ period: label, kind: 'pattern', text: `${p.title}: ${p.text}` })
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
    } else if (verdict === GOOD) {
      advice.push({
        period: label,
        kind: 'contrast',
        text:
          `${label} is still a good period overall despite a ${b.approxMonths}-month dip (${b.from} → ${b.to}). ` +
          `Study the dip; do not let it rewrite the whole window.`,
      })
    }
  }

  // Domain-specific closer
  if (causal?.alcohol?.maxDrinks >= 10) {
    advice.push({
      period: label,
      kind: 'action',
      text:
        `For ${label}: treat max ${causal.alcohol.maxDrinks}-drink day(s) as the priority intervention — ` +
        `stack clean Anchor days before trusting RHR/HRV as fitness. Easy aerobic only after a clean night.`,
    })
  } else if (domains?.activity?.sessions === 0 && domains?.restingHr?.latest != null && domains.restingHr.latest <= 56) {
    advice.push({
      period: label,
      kind: 'action',
      text:
        `For ${label}: do not read RHR ${Math.round(domains.restingHr.latest)} as fitness while sessions=0. ` +
        `Schedule 3 easy aerobic sessions next week and re-check whether RHR stays low under load.`,
    })
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

function deepenHorizon(base, dailySlice, confounders = {}) {
  const domains = domainStats(dailySlice)
  const cross = crossMetricMatrix(dailySlice)
  const causal = analyzeCausal(dailySlice, { ...confounders, domains })
  const patterns = interpretPatterns(domains, cross, causal.enrichedDaily || dailySlice, causal)
  const analysis = buildDeepNarrative({
    label: base.label,
    verdict: base.verdict,
    score: base.score,
    weeks: base.weeks,
    domains,
    cross,
    patterns,
    nested: base.nested,
    causal,
  })
  const advice = adviceForHorizon({
    label: base.label,
    verdict: base.verdict,
    score: base.score,
    nested: base.nested,
    weeks: base.weeks,
    coverageRatio: base.coverageRatio,
    patterns,
    domains,
    causal,
  })
  return {
    ...base,
    domains,
    crossLinks: cross,
    patterns,
    causal: {
      alcohol: causal.alcohol,
      lags: {
        afterDrink: causal.lags.afterDrink,
        afterClean: causal.lags.afterClean,
        afterBinge: causal.lags.afterBinge,
        deltasDrinkVsClean: causal.lags.deltasDrinkVsClean,
        deltasBingeVsClean: causal.lags.deltasBingeVsClean,
        examples: causal.lags.examples,
      },
      hypotheses: causal.hypotheses,
      topHypothesis: causal.topHypothesis,
      narrative: causal.narrative,
    },
    analysis,
    findings: patterns.map(p => p.title),
    advice,
  }
}

function clipConfounders(confounders, from, to) {
  const inRange = rows => (rows || []).filter(r => r.date >= from && r.date <= to)
  return {
    recoveries: inRange(confounders.recoveries),
    dayEntries: inRange(confounders.dayEntries),
    weights: inRange(confounders.weights),
  }
}

/**
 * @param {object} data - Garmin rows + optional recoveries/dayEntries/weights
 * @param {object} opts
 * @param {string} [opts.asOf]
 * @param {number[]} [opts.horizonsMonths]
 */
export function analyzePeriods(data, opts = {}) {
  const daily = buildDailySignals(data)
  const weeklyAll = buildWeeklyScores(daily)
  const segmentsAll = findSegments(weeklyAll)
  const confoundersAll = {
    recoveries: data.recoveries || [],
    dayEntries: data.dayEntries || [],
    weights: data.weights || data.weightAlcohol || [],
  }

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
    const coverageRatio = Math.round((daysWithData / expectedDays) * 100) / 100
    const base = {
      label,
      months,
      from,
      to,
      ...stats,
      coverageRatio,
      segments,
      nested,
    }
    horizons.push(deepenHorizon(base, clipDaily(daily, from, to), clipConfounders(confoundersAll, from, to)))
  }

  if (dataFrom && dataTo) {
    const label = 'all available history'
    const stats = horizonVerdict(weeklyAll)
    const nested = nestedBreakdown(segmentsAll, label)
    const base = {
      label,
      months: null,
      from: dataFrom,
      to: dataTo,
      ...stats,
      coverageRatio: null,
      segments: segmentsAll,
      nested,
    }
    horizons.push(deepenHorizon(base, daily, confoundersAll))
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
    const topH = h12.causal?.topHypothesis
    if (topH) headlineParts.push(`Leading cause: ${topH.label} (${Math.round(topH.confidence * 100)}%).`)
    else if (h12.patterns?.[0]) headlineParts.push(`Top signal: ${h12.patterns[0].title}.`)
  } else if (segmentsAll.length) {
    const last = segmentsAll[segmentsAll.length - 1]
    headlineParts.push(`Latest stretch is ${last.verdict} (${last.from} → ${last.to}, ~${last.approxMonths} mo).`)
  } else {
    headlineParts.push('Not enough Garmin/health rows to build period advice yet.')
  }

  const global = horizons.find(h => h.months == null) || h12 || horizons[0] || null

  return {
    asOf,
    dataSpan: { from: dataFrom, to: dataTo },
    weeklyCount: weeklyAll.length,
    segments: segmentsAll,
    horizons,
    headline: headlineParts.join(' '),
    deepAnalysis: global?.analysis || headlineParts.join(' '),
    causalNarrative: global?.causal?.narrative || null,
    topPatterns: global?.patterns?.slice(0, 8) || [],
    topHypothesis: global?.causal?.topHypothesis || null,
  }
}

export function periodsToMarkdown(report) {
  const lines = [
    '# Period Review (deep)',
    '',
    `_As of ${report.asOf} · data ${report.dataSpan.from || '—'} → ${report.dataSpan.to || '—'}_`,
    '',
    '## Headline',
    report.headline,
    '',
    '## Deep analysis',
    report.deepAnalysis || '_none_',
    '',
    '## Causal engine',
    report.causalNarrative || report.topHypothesis?.text || '_none_',
    '',
    '## How to use this',
    '- Weekly Feedback = this ISO week only.',
    '- Period Review = multi-month advice. Always name the window.',
    '- Binge drinking (e.g. 15 beers) outranks flattering low RHR — log Anchor alcoholDrinks.',
    '- Low resting HR without activity is calm, not fitness — unless alcohol explains the idle.',
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
    if (h.analysis) {
      lines.push('### Analysis')
      lines.push(h.analysis)
      lines.push('')
    }
    if (h.crossLinks?.length) {
      lines.push('### Cross-metric correlations')
      for (const p of h.crossLinks.slice(0, 12)) {
        lines.push(`- ${describeCorr(p)} (n=${p.n})`)
      }
      lines.push('')
    }
    if (h.patterns?.length) {
      lines.push('### Patterns')
      for (const p of h.patterns) {
        lines.push(`- **[${p.severity}] ${p.title}** — ${p.text}`)
      }
      lines.push('')
    }
    lines.push('### Advice')
    for (const a of h.advice || []) {
      lines.push(`- *(${a.period})* ${a.text}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function escHtml(s) {
  return esc(s)
}

/** Standalone HTML for double-click / `start` — no server required. */
export function periodsToHtml(report) {
  const conf = report.topHypothesis
    ? Math.round((report.topHypothesis.confidence || 0) * 100)
    : null

  const horizons = (report.horizons || [])
    .map(h => {
      if (!h.verdict) {
        return `<article class="horizon"><strong>${escHtml(h.label)}</strong><div class="meta">No scored weeks in this window.</div></article>`
      }
      const patterns = (h.patterns || [])
        .slice(0, 4)
        .map(p => `<li><strong>${escHtml(p.title)}</strong> — ${escHtml(p.text)}</li>`)
        .join('')
      const advice = (h.advice || [])
        .slice(0, 5)
        .map(a => `<li>${escHtml(a.text)}</li>`)
        .join('')
      return `<article class="horizon">
  <div class="horizon-top">
    <div><strong>${escHtml(h.label)}</strong></div>
    <span class="verdict ${escHtml(h.verdict)}">${escHtml(h.verdict)}</span>
  </div>
  <div class="meta" style="margin-top:8px">
    Score ${h.score}/100 · ${h.weeks} weeks
    (${h.goodWeeks} good / ${h.mixedWeeks} mixed / ${h.badWeeks} bad)
    ${h.causal?.topHypothesis ? ` · Cause: ${escHtml(friendlyCausal(h.causal.topHypothesis.id) || h.causal.topHypothesis.label)}` : ''}
  </div>
  ${h.analysis ? `<details style="margin-top:10px"><summary>Read analysis</summary><p class="prose">${escHtml(h.analysis)}</p></details>` : ''}
  ${patterns ? `<h3 style="margin-top:12px">Patterns</h3><ul class="list findings">${patterns}</ul>` : ''}
  ${advice ? `<h3 style="margin-top:12px">Advice</h3><ul class="list wins">${advice}</ul>` : ''}
</article>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Period Review — ${escHtml(report.asOf)}</title>
<style>${reportCss()}</style></head><body><main>
<p class="kicker">MY PENS · Period review</p>
<h1>Period conclusions</h1>
<p class="sub">As of ${escHtml(report.asOf)} · data ${escHtml(report.dataSpan?.from || '—')} → ${escHtml(report.dataSpan?.to || '—')}</p>
<section class="hero"><div class="score pass">${escHtml(report.headline)}</div></section>
<section class="callout" style="margin-top:16px">
  <div class="title">${escHtml(report.topHypothesis?.label || 'No clear leading cause')}</div>
  <div class="note">${conf != null ? `${conf}% confidence` : ''}</div>
  <p class="prose" style="margin-top:10px">${escHtml(report.causalNarrative || report.topHypothesis?.text || 'No causal narrative.')}</p>
</section>
<h2>Deep analysis</h2>
<div class="card prose">${escHtml(report.deepAnalysis || 'none')}</div>
<h2>By time window</h2>
${horizons}
</main></body></html>`
}

export { GOOD, MIXED, BAD, weekBounds }
