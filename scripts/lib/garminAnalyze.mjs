// =============================================================================
// Garmin Analysis Engine
//
// Deterministic deep-dive over EVERYTHING imported from a Garmin Connect dump:
//   SleepEntry · WeightEntry · TrainingEntry · GarminActivity · GarminDailyMetric
//
// Produces:
//   - inventory (what data exists)
//   - per-domain stats (sleep / stress / HRV / steps / RHR / activities)
//   - trends (first-half vs second-half of the window)
//   - cross-links (stress↑ vs sleep↓, HRV↓ vs stress↑, hard training vs RHR)
//   - findings[] — plain-language bullets the weekly report / Claude can use
//
// Pure analysis — no Anthropic calls. Safe to run offline after import.
// =============================================================================

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
  // Pairwise correlation for equal-length arrays (nulls skipped pairwise by date join upstream)
  const n = Math.min(xs.length, ys.length)
  if (n < 5) return null
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, c = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i]
    if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) continue
    c++
    sx += x; sy += y
    sxx += x * x; syy += y * y; sxy += x * y
  }
  if (c < 5) return null
  const num = c * sxy - sx * sy
  const den = Math.sqrt((c * sxx - sx * sx) * (c * syy - sy * sy))
  if (!den) return null
  return Math.round((num / den) * 100) / 100
}

function seriesByDate(rows, dateKey, valueFn) {
  const map = new Map()
  for (const r of rows) {
    const d = r[dateKey]
    const v = valueFn(r)
    if (!d || v == null || Number.isNaN(v)) continue
    map.set(d, v)
  }
  const dates = [...map.keys()].sort()
  return { dates, values: dates.map(d => map.get(d)) }
}

function joinByDate(a, b) {
  const set = new Set(a.dates.filter(d => b.dates.includes(d)))
  const dates = [...set].sort()
  const xs = [], ys = []
  for (const d of dates) {
    xs.push(a.values[a.dates.indexOf(d)])
    ys.push(b.values[b.dates.indexOf(d)])
  }
  return { dates, xs, ys }
}

/**
 * @param {object} data
 * @param {Array} data.sleeps - SleepEntry rows {date, hours, quality, hrv?}
 * @param {Array} data.weights - WeightEntry {date, trueWeightKg|scaleKg}
 * @param {Array} data.trainings - TrainingEntry {date, volume, exercise?, source?}
 * @param {Array} data.activities - GarminActivity {date, sport, durationSec, distanceM, avgHr, calories}
 * @param {Array} data.metrics - GarminDailyMetric {date, kind, valueNum}
 * @param {string} [data.weekOf]
 * @param {string} [data.weekEnd]
 */
export function analyzeGarmin(data) {
  const sleeps = data.sleeps || []
  const weights = data.weights || []
  const trainings = data.trainings || []
  const activities = data.activities || []
  const metrics = data.metrics || []

  // Training provenance: strava | garmin | manual | healthkit | …
  const trainingBySource = {}
  let trainingVolume = 0
  for (const t of trainings) {
    const src = (t.source || 'manual').toLowerCase()
    if (!trainingBySource[src]) trainingBySource[src] = { count: 0, volume: 0 }
    trainingBySource[src].count++
    trainingBySource[src].volume += t.volume || 0
    trainingVolume += t.volume || 0
  }

  const bodyFatSeries = seriesByDate(
    weights.filter(w => typeof w.bodyFatPct === 'number'),
    'date',
    w => w.bodyFatPct,
  )
  const tanitaWeights = weights.filter(
    w => (w.source || '').toLowerCase().includes('tanita') || typeof w.bodyFatPct === 'number',
  )

  const byKind = {}
  for (const m of metrics) {
    if (m.valueNum == null) continue
    if (!byKind[m.kind]) byKind[m.kind] = []
    byKind[m.kind].push(m)
  }

  const metricSeries = kind =>
    seriesByDate(byKind[kind] || [], 'date', r => r.valueNum)

  const sleepSeries = seriesByDate(sleeps, 'date', r => r.hours)
  const stressSeries = metricSeries('stress')
  const hrvSeries = metricSeries('hrv')
  const rhrSeries = metricSeries('resting_hr')
  const stepsSeries = metricSeries('steps')
  const bbMaxSeries = metricSeries('body_battery_max')

  // Activities by sport
  const bySport = {}
  let totalDurationSec = 0
  let totalDistanceM = 0
  for (const a of activities) {
    const sport = (a.sport || 'unknown').toLowerCase()
    if (!bySport[sport]) bySport[sport] = { count: 0, durationSec: 0, distanceM: 0 }
    bySport[sport].count++
    bySport[sport].durationSec += a.durationSec || 0
    bySport[sport].distanceM += a.distanceM || 0
    totalDurationSec += a.durationSec || 0
    totalDistanceM += a.distanceM || 0
  }

  const inventory = {
    sleepNights: sleeps.length,
    weightEntries: weights.length,
    trainingEntries: trainings.length,
    garminActivities: activities.length,
    wellnessKinds: Object.keys(byKind).sort(),
    wellnessPoints: metrics.length,
    dateSpan: {
      from: minDate([
        ...sleeps.map(s => s.date),
        ...activities.map(a => a.date),
        ...metrics.map(m => m.date),
        ...weights.map(w => w.date),
      ]),
      to: maxDate([
        ...sleeps.map(s => s.date),
        ...activities.map(a => a.date),
        ...metrics.map(m => m.date),
        ...weights.map(w => w.date),
      ]),
    },
  }

  const domains = {
    sleep: sleeps.length
      ? {
          nights: sleeps.length,
          avgHours: avg(sleeps.map(s => s.hours)),
          medianHours: median(sleeps.map(s => s.hours)),
          minHours: min(sleeps.map(s => s.hours)),
          maxHours: max(sleeps.map(s => s.hours)),
          avgQuality: avg(sleeps.map(s => s.quality)),
          shortNights: sleeps.filter(s => s.hours < 6.5).length,
          trend: trend(sleepSeries.values),
        }
      : null,
    stress: stressSeries.values.length
      ? {
          days: stressSeries.values.length,
          avg: avg(stressSeries.values),
          median: median(stressSeries.values),
          max: max(stressSeries.values),
          highDays: stressSeries.values.filter(v => v >= 50).length,
          trend: trend(stressSeries.values),
        }
      : null,
    hrv: hrvSeries.values.length
      ? {
          days: hrvSeries.values.length,
          avg: avg(hrvSeries.values),
          median: median(hrvSeries.values),
          min: min(hrvSeries.values),
          trend: trend(hrvSeries.values),
        }
      : null,
    restingHr: rhrSeries.values.length
      ? {
          days: rhrSeries.values.length,
          avg: avg(rhrSeries.values),
          min: min(rhrSeries.values),
          max: max(rhrSeries.values),
          trend: trend(rhrSeries.values),
        }
      : null,
    steps: stepsSeries.values.length
      ? {
          days: stepsSeries.values.length,
          avg: avg(stepsSeries.values),
          median: median(stepsSeries.values),
          lowDays: stepsSeries.values.filter(v => v < 5000).length,
          trend: trend(stepsSeries.values),
        }
      : null,
    bodyBattery: bbMaxSeries.values.length
      ? {
          days: bbMaxSeries.values.length,
          avgMax: avg(bbMaxSeries.values),
          trend: trend(bbMaxSeries.values),
        }
      : null,
    activities: activities.length
      ? {
          count: activities.length,
          totalHours: Math.round((totalDurationSec / 3600) * 10) / 10,
          totalKm: Math.round((totalDistanceM / 1000) * 10) / 10,
          bySport: Object.fromEntries(
            Object.entries(bySport)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 12)
              .map(([k, v]) => [
                k,
                {
                  count: v.count,
                  hours: Math.round((v.durationSec / 3600) * 10) / 10,
                  km: Math.round((v.distanceM / 1000) * 10) / 10,
                },
              ]),
          ),
        }
      : null,
    weight: weights.length
      ? {
          entries: weights.length,
          latestKg: weights[weights.length - 1]?.trueWeightKg ?? weights[weights.length - 1]?.scaleKg ?? null,
          avgKg: avg(weights.map(w => w.trueWeightKg ?? w.scaleKg)),
          tanitaEntries: tanitaWeights.length,
          latestBodyFatPct: bodyFatSeries.values.length
            ? bodyFatSeries.values[bodyFatSeries.values.length - 1]
            : null,
          avgBodyFatPct: avg(bodyFatSeries.values),
          bodyFatTrend: trend(bodyFatSeries.values),
        }
      : null,
    training: trainings.length
      ? {
          sessions: trainings.length,
          totalVolume: Math.round(trainingVolume),
          bySource: trainingBySource,
          stravaSessions: trainingBySource.strava?.count || 0,
          manualSessions: trainingBySource.manual?.count || 0,
        }
      : null,
  }

  // Cross-links
  const cross = {}
  const stressSleep = joinByDate(stressSeries, sleepSeries)
  cross.stressVsSleep = pearson(stressSleep.xs, stressSleep.ys)
  const hrvStress = joinByDate(hrvSeries, stressSeries)
  cross.hrvVsStress = pearson(hrvStress.xs, hrvStress.ys)
  const hrvSleep = joinByDate(hrvSeries, sleepSeries)
  cross.hrvVsSleep = pearson(hrvSleep.xs, hrvSleep.ys)
  const stepsSleep = joinByDate(stepsSeries, sleepSeries)
  cross.stepsVsSleep = pearson(stepsSleep.xs, stepsSleep.ys)

  const findings = []
  const risks = []
  const wins = []

  if (!inventory.sleepNights && !inventory.garminActivities && !inventory.wellnessPoints) {
    findings.push('No Garmin-derived data in the database yet — run the dump importer first.')
  }

  if (domains.sleep) {
    findings.push(
      `Sleep: ${domains.sleep.nights} nights, avg ${domains.sleep.avgHours}h (median ${domains.sleep.medianHours}h), trend ${domains.sleep.trend}, ${domains.sleep.shortNights} nights under 6.5h.`,
    )
    if (domains.sleep.avgHours < 6.5) risks.push('Average sleep under 6.5h — recovery debt is compounding.')
    if (domains.sleep.shortNights >= 3) risks.push(`${domains.sleep.shortNights} short nights in window — protect a fixed wind-down.`)
    if (domains.sleep.avgHours >= 7 && domains.sleep.trend !== 'down') wins.push('Sleep holding at a workable average.')
  }

  if (domains.stress) {
    findings.push(
      `Stress: avg ${domains.stress.avg} over ${domains.stress.days}d (max ${domains.stress.max}), ${domains.stress.highDays} high-stress days (≥50), trend ${domains.stress.trend}.`,
    )
    if (domains.stress.avg >= 40) risks.push('Elevated average stress — pair hard days with easier recovery blocks.')
    if (domains.stress.trend === 'up') risks.push('Stress trending up across the window.')
    if (domains.stress.avg < 30) wins.push('Stress load looks manageable on average.')
  }

  if (domains.hrv) {
    findings.push(
      `HRV: avg ${domains.hrv.avg}ms over ${domains.hrv.days}d (min ${domains.hrv.min}), trend ${domains.hrv.trend}.`,
    )
    if (domains.hrv.trend === 'down') risks.push('HRV trending down — back off intensity until it stabilises.')
    if (domains.hrv.trend === 'up') wins.push('HRV trending up — recovery capacity improving.')
  }

  if (domains.restingHr) {
    findings.push(
      `Resting HR: avg ${domains.restingHr.avg} bpm (${domains.restingHr.min}–${domains.restingHr.max}), trend ${domains.restingHr.trend}.`,
    )
    if (domains.restingHr.trend === 'up') risks.push('Resting HR trending up — classic under-recovery signal.')
  }

  if (domains.steps) {
    findings.push(
      `Steps: avg ~${Math.round(domains.steps.avg)} over ${domains.steps.days}d, ${domains.steps.lowDays} low days (<5k), trend ${domains.steps.trend}.`,
    )
  }

  if (domains.activities) {
    const topSports = Object.entries(domains.activities.bySport)
      .slice(0, 4)
      .map(([k, v]) => `${k}×${v.count}`)
      .join(', ')
    findings.push(
      `Activities: ${domains.activities.count} sessions, ${domains.activities.totalHours}h, ${domains.activities.totalKm} km. Top: ${topSports || 'n/a'}.`,
    )
    if (domains.activities.count >= 3) wins.push(`${domains.activities.count} Garmin sessions logged in window.`)
  }

  if (domains.weight?.latestKg != null) {
    findings.push(`Weight: latest ${domains.weight.latestKg} kg (avg ${domains.weight.avgKg} across ${domains.weight.entries} entries).`)
  }
  if (domains.weight?.latestBodyFatPct != null) {
    findings.push(
      `Body comp (Tanita-style): latest BF ${domains.weight.latestBodyFatPct}%` +
        (domains.weight.avgBodyFatPct != null ? ` (avg ${domains.weight.avgBodyFatPct}%)` : '') +
        `, trend ${domains.weight.bodyFatTrend}, ${domains.weight.tanitaEntries} composition-capable weigh-ins.`,
    )
    if (domains.weight.bodyFatTrend === 'down') wins.push('Body-fat trend down across the window.')
    if (domains.weight.bodyFatTrend === 'up') risks.push('Body-fat trend up — check calorie / alcohol load.')
  }
  if (domains.training) {
    const srcBits = Object.entries(domains.training.bySource)
      .map(([k, v]) => `${k}×${v.count}`)
      .join(', ')
    findings.push(
      `Training ledger: ${domains.training.sessions} sessions (volume ~${domains.training.totalVolume}). Sources: ${srcBits || 'n/a'}.`,
    )
    if (domains.training.stravaSessions > 0) {
      wins.push(`${domains.training.stravaSessions} Strava-sourced training rows in window.`)
    }
  }

  // Correlation findings
  if (cross.stressVsSleep != null) {
    const r = cross.stressVsSleep
    findings.push(`Correlation stress↔sleep hours: r=${r}${r < -0.25 ? ' (higher stress tracks with shorter sleep)' : r > 0.25 ? ' (unexpected positive link — check data quality)' : ' (weak).'}`)
    if (r < -0.3) risks.push('Stress and short sleep are moving together — treat evening load as a sleep intervention.')
  }
  if (cross.hrvVsStress != null) {
    const r = cross.hrvVsStress
    findings.push(`Correlation HRV↔stress: r=${r}${r < -0.25 ? ' (HRV drops when stress rises — expected)' : ''}.`)
  }
  if (cross.hrvVsSleep != null && cross.hrvVsSleep > 0.25) {
    findings.push(`HRV rises with longer sleep (r=${cross.hrvVsSleep}) — sleep is a lever for recovery capacity.`)
    wins.push('Sleep length shows a positive link with HRV.')
  }

  const coverageScore = [
    inventory.sleepNights > 0,
    inventory.garminActivities > 0,
    (byKind.stress || []).length > 0,
    (byKind.hrv || []).length > 0,
    (byKind.steps || []).length > 0,
    inventory.weightEntries > 0,
    inventory.trainingEntries > 0, // Strava / manual ledger
  ].filter(Boolean).length

  return {
    weekOf: data.weekOf || null,
    weekEnd: data.weekEnd || null,
    inventory,
    domains,
    crossLinks: cross,
    findings,
    risks: risks.slice(0, 8),
    wins: wins.slice(0, 8),
    coverageScore, // 0–7 domains present (Garmin + Strava/Tanita ledger)
    coverageMax: 7,
    summary:
      findings[0] ||
      'Garmin analysis ran but found no usable rows — import the Connect dump first.',
  }
}

function minDate(dates) {
  const a = dates.filter(Boolean).sort()
  return a[0] || null
}
function maxDate(dates) {
  const a = dates.filter(Boolean).sort()
  return a.length ? a[a.length - 1] : null
}

/**
 * Load all Garmin-related rows for a date window (or all history if no bounds).
 */
export async function loadGarminData(prisma, { weekOf, weekEnd, allTime = false } = {}) {
  const range = !allTime && weekOf && weekEnd ? { gte: weekOf, lte: weekEnd } : undefined
  const whereDate = range ? { date: range } : {}

  const safe = async (label, fn) => {
    try {
      return await fn()
    } catch (err) {
      console.warn(`[garmin-analyze] ${label} skipped:`, err?.message?.split('\n')[0] || err)
      return []
    }
  }

  const [sleeps, weights, trainings, activities, metrics] = await Promise.all([
    safe('sleep', () =>
      prisma.sleepEntry.findMany({
        where: whereDate,
        orderBy: { date: 'asc' },
        select: { date: true, hours: true, quality: true, hrv: true },
      }),
    ),
    safe('weight', () =>
      prisma.weightEntry.findMany({
        where: whereDate,
        orderBy: { date: 'asc' },
        select: {
          date: true,
          trueWeightKg: true,
          scaleKg: true,
          bodyFatPct: true,
          muscleMassKg: true,
          source: true,
          alcoholUnits: true,
        },
      }),
    ),
    safe('training', () =>
      prisma.trainingEntry.findMany({
        where: whereDate,
        select: {
          date: true,
          volume: true,
          exercise: true,
          source: true,
          sets: true,
          reps: true,
          weightKg: true,
        },
      }),
    ),
    safe('activities', () =>
      prisma.garminActivity.findMany({
        where: whereDate,
        orderBy: { date: 'asc' },
        select: {
          date: true,
          sport: true,
          name: true,
          durationSec: true,
          distanceM: true,
          avgHr: true,
          maxHr: true,
          calories: true,
          subSport: true,
        },
      }),
    ),
    safe('metrics', () =>
      prisma.garminDailyMetric
        ? prisma.garminDailyMetric.findMany({
            where: whereDate,
            orderBy: { date: 'asc' },
            select: { date: true, kind: true, valueNum: true, unit: true },
          })
        : [],
    ),
  ])

  return { sleeps, weights, trainings, activities, metrics, weekOf, weekEnd }
}
