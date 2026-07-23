// =============================================================================
// Period Causal Engine — detailed “what happened?” layer
//
// Ranks competing explanations for a window (alcohol binge, idle under-load,
// sleep debt, stress stack, illness-like autonomic drift) using:
//   - Anchor RecoveryEntry.alcoholDrinks
//   - DayEntry tags (alcohol | late_night | …)
//   - WeightEntry alcoholUnits (secondary)
//   - Garmin daily signals with NEXT-DAY lag after drink days
//
// Example: 15 beers + no training is not “fitness from low RHR” — it is a
// hangover/idle stack. Low night RHR can still appear if measurement timing
// misses the rebound, or if residual fitness masks the average.
//
// Does NOT modify lib/retentionModels.ts.
// =============================================================================

import { shiftDateStr } from './weekDates.mjs'

export function classifyDrinkLoad(n) {
  const d = Number(n) || 0
  if (d <= 0) return 'clean'
  if (d <= 2) return 'light'
  if (d <= 5) return 'moderate'
  if (d <= 9) return 'heavy'
  return 'binge' // 10+ — 15 beers lands here
}

/**
 * RHR drinking ladder (night / resting HR).
 *   ≤49  clean_band
 *   ≥50  likely_drinking  (“definitely been drinking”)
 *   ≥55  heavy_stack      (“very bad — heavy drinking and/or other load”)
 */
export function classifyRhrDrinkBand(rhr) {
  if (rhr == null || Number.isNaN(Number(rhr))) return null
  const v = Number(rhr)
  if (v >= 55) return 'heavy_stack'
  if (v >= 50) return 'likely_drinking'
  return 'clean_band'
}

export function rhrDrinkWindowStats(daily) {
  const withRhr = (daily || []).filter(d => d.restingHr != null && !Number.isNaN(Number(d.restingHr)))
  const likelyDays = withRhr.filter(d => Number(d.restingHr) >= 50)
  const heavyDays = withRhr.filter(d => Number(d.restingHr) >= 55)
  const latest = [...withRhr].reverse()[0] || null
  return {
    daysWithRhr: withRhr.length,
    likelyDrinkingDays: likelyDays.length,
    heavyStackDays: heavyDays.length,
    latestRhr: latest?.restingHr ?? null,
    latestBand: latest ? classifyRhrDrinkBand(latest.restingHr) : null,
    maxRhr: withRhr.length ? Math.max(...withRhr.map(d => Number(d.restingHr))) : null,
    shareLikely:
      withRhr.length === 0 ? 0 : Math.round((likelyDays.length / withRhr.length) * 100) / 100,
    shareHeavy: withRhr.length === 0 ? 0 : Math.round((heavyDays.length / withRhr.length) * 100) / 100,
    exampleHeavyDates: heavyDays.slice(-3).map(d => d.date),
    exampleLikelyDates: likelyDays.slice(-3).map(d => d.date),
  }
}

function avg(nums) {
  const a = nums.filter(n => typeof n === 'number' && !Number.isNaN(n))
  if (!a.length) return null
  return Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10
}

function parseTags(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/**
 * Attach confounders onto daily signal rows (mutates copies).
 */
export function attachConfounders(daily, { recoveries = [], dayEntries = [], weights = [] } = {}) {
  const byRec = new Map(recoveries.map(r => [r.date, r]))
  const byDay = new Map(dayEntries.map(d => [d.date, d]))
  const byW = new Map()
  for (const w of weights) {
    if (!w?.date) continue
    // keep max alcoholUnits if multiple weigh-ins
    const prev = byW.get(w.date)
    const units = w.alcoholUnits ?? 0
    if (!prev || units > (prev.alcoholUnits ?? 0)) byW.set(w.date, w)
  }

  return daily.map(d => {
    const rec = byRec.get(d.date)
    const de = byDay.get(d.date)
    const w = byW.get(d.date)
    const tags = parseTags(de?.tags)
    const drinks = rec?.alcoholDrinks ?? 0
    const weightUnits = w?.alcoholUnits ?? 0
    // Prefer Anchor drink count; fall back to weight units as proxy
    const alcoholDrinks = drinks > 0 ? drinks : weightUnits > 0 ? Math.round(weightUnits) : 0
    const load = classifyDrinkLoad(alcoholDrinks)
    return {
      ...d,
      alcoholDrinks,
      drinkLoad: load,
      isDrinkDay: alcoholDrinks > 0 || tags.includes('alcohol'),
      isBinge: load === 'binge' || alcoholDrinks >= 10,
      isHeavy: load === 'heavy' || load === 'binge' || alcoholDrinks >= 6,
      lateNight: tags.includes('late_night'),
      tagAlcohol: tags.includes('alcohol'),
      cocaineUsed: Boolean(rec?.cocaineUsed),
      escortUsed: Boolean(rec?.escortUsed),
      anchorMood: rec?.mood ?? null,
      anchorEnergy: rec?.energy ?? null,
      hoursSinceAlcohol: w?.hoursSinceAlcohol ?? null,
      illnessDay: Boolean(w?.illnessDay),
    }
  })
}

/**
 * Compare next-day physiology after drink days vs after clean days.
 * Drink on D → look at D+1 metrics (classic hangover lag).
 */
export function lagEffects(dailyWithConfounders) {
  const byDate = new Map(dailyWithConfounders.map(d => [d.date, d]))
  const afterDrink = []
  const afterClean = []
  const afterBinge = []

  for (const d of dailyWithConfounders) {
    if (!d.isDrinkDay && d.alcoholDrinks <= 0) continue
    const next = byDate.get(shiftDateStr(d.date, 1))
    if (!next) continue
    const row = {
      drinkDate: d.date,
      drinks: d.alcoholDrinks,
      load: d.drinkLoad,
      nextDate: next.date,
      restingHr: next.restingHr,
      hrv: next.hrv,
      stress: next.stress,
      sleepHours: next.sleepHours,
      steps: next.steps,
      activityCount: next.activityCount,
      activityMinutes: next.activityMinutes,
    }
    afterDrink.push(row)
    if (d.isBinge || d.alcoholDrinks >= 10) afterBinge.push(row)
  }

  for (const d of dailyWithConfounders) {
    if (d.isDrinkDay || d.alcoholDrinks > 0) continue
    // clean day whose previous day was also clean (stricter baseline)
    const prev = byDate.get(shiftDateStr(d.date, -1))
    if (prev && (prev.isDrinkDay || prev.alcoholDrinks > 0)) continue
    afterClean.push({
      drinkDate: null,
      drinks: 0,
      load: 'clean',
      nextDate: d.date,
      restingHr: d.restingHr,
      hrv: d.hrv,
      stress: d.stress,
      sleepHours: d.sleepHours,
      steps: d.steps,
      activityCount: d.activityCount,
      activityMinutes: d.activityMinutes,
    })
  }

  const summarize = rows => ({
    n: rows.length,
    restingHr: avg(rows.map(r => r.restingHr)),
    hrv: avg(rows.map(r => r.hrv)),
    stress: avg(rows.map(r => r.stress)),
    sleepHours: avg(rows.map(r => r.sleepHours)),
    steps: avg(rows.map(r => r.steps)),
    activityCount: avg(rows.map(r => r.activityCount)),
    zeroActivityShare:
      rows.length === 0
        ? null
        : Math.round((rows.filter(r => (r.activityCount || 0) === 0).length / rows.length) * 100) / 100,
  })

  const drink = summarize(afterDrink)
  const clean = summarize(afterClean)
  const binge = summarize(afterBinge)

  const delta = (a, b) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10)

  return {
    afterDrink: drink,
    afterClean: clean,
    afterBinge: binge,
    deltasDrinkVsClean: {
      restingHr: delta(drink.restingHr, clean.restingHr),
      hrv: delta(drink.hrv, clean.hrv),
      stress: delta(drink.stress, clean.stress),
      sleepHours: delta(drink.sleepHours, clean.sleepHours),
      steps: delta(drink.steps, clean.steps),
    },
    deltasBingeVsClean: {
      restingHr: delta(binge.restingHr, clean.restingHr),
      hrv: delta(binge.hrv, clean.hrv),
      stress: delta(binge.stress, clean.stress),
      sleepHours: delta(binge.sleepHours, clean.sleepHours),
      steps: delta(binge.steps, clean.steps),
    },
    examples: {
      biggestBinges: [...dailyWithConfounders]
        .filter(d => d.alcoholDrinks >= 8)
        .sort((a, b) => b.alcoholDrinks - a.alcoholDrinks)
        .slice(0, 5)
        .map(d => ({
          date: d.date,
          drinks: d.alcoholDrinks,
          load: d.drinkLoad,
          next: (() => {
            const n = byDate.get(shiftDateStr(d.date, 1))
            if (!n) return null
            return {
              date: n.date,
              restingHr: n.restingHr,
              hrv: n.hrv,
              stress: n.stress,
              sleepHours: n.sleepHours,
              activityCount: n.activityCount,
              steps: n.steps,
            }
          })(),
        })),
    },
  }
}

export function alcoholWindowStats(dailyWithConfounders) {
  const drinkDays = dailyWithConfounders.filter(d => d.alcoholDrinks > 0 || d.isDrinkDay)
  const bingeDays = dailyWithConfounders.filter(d => d.isBinge || d.alcoholDrinks >= 10)
  const heavyDays = dailyWithConfounders.filter(d => d.isHeavy)
  const totalDrinks = dailyWithConfounders.reduce((s, d) => s + (d.alcoholDrinks || 0), 0)
  const maxDrinks = Math.max(0, ...dailyWithConfounders.map(d => d.alcoholDrinks || 0))
  const lateNightDays = dailyWithConfounders.filter(d => d.lateNight).length
  return {
    daysInWindow: dailyWithConfounders.length,
    drinkDays: drinkDays.length,
    heavyDays: heavyDays.length,
    bingeDays: bingeDays.length,
    totalDrinks,
    maxDrinks,
    avgDrinksOnDrinkDays: drinkDays.length ? avg(drinkDays.map(d => d.alcoholDrinks)) : 0,
    drinkDayShare: dailyWithConfounders.length
      ? Math.round((drinkDays.length / dailyWithConfounders.length) * 100) / 100
      : 0,
    lateNightDays,
    maxDrinkDate: dailyWithConfounders.find(d => d.alcoholDrinks === maxDrinks && maxDrinks > 0)?.date || null,
  }
}

/**
 * Rank hypotheses with confidence 0–1 and long explanation text.
 */
export function rankHypotheses({ daily, domains, alcohol, lags }) {
  const hypotheses = []
  const act = domains?.activity
  const rhr = domains?.restingHr
  const latestRhr = rhr?.latest ?? rhr?.avg
  const noActivity =
    act &&
    (act.sessions === 0 ||
      act.activeDays === 0 ||
      (act.zeroActivityShare != null && act.zeroActivityShare >= 0.8))

  // --- H1: Alcohol / binge primary ---
  if (alcohol && (alcohol.bingeDays > 0 || alcohol.maxDrinks >= 8 || alcohol.totalDrinks >= 20)) {
    const binge = alcohol.maxDrinks >= 10
    let conf = 0.55
    if (alcohol.bingeDays > 0) conf += 0.2
    if (alcohol.maxDrinks >= 12) conf += 0.1
    if (noActivity) conf += 0.1
    if (lags?.deltasBingeVsClean?.hrv != null && lags.deltasBingeVsClean.hrv < -2) conf += 0.05
    if (lags?.deltasBingeVsClean?.restingHr != null && lags.deltasBingeVsClean.restingHr > 2) conf += 0.05
    conf = Math.min(0.98, conf)

    const ex = lags?.examples?.biggestBinges?.[0]
    hypotheses.push({
      id: 'alcohol_binge_stack',
      label: binge ? 'Heavy / binge drinking stack' : 'Elevated drinking load',
      confidence: Math.round(conf * 100) / 100,
      priority: 1,
      text: buildAlcoholHypothesisText({ alcohol, lags, domains, noActivity, latestRhr, example: ex }),
    })
  } else if (alcohol && alcohol.drinkDays > 0) {
    hypotheses.push({
      id: 'alcohol_present',
      label: 'Alcohol present in window',
      confidence: Math.min(0.75, 0.35 + alcohol.drinkDayShare),
      priority: 2,
      text:
        `${alcohol.drinkDays} drink day(s), ${alcohol.totalDrinks} drinks total (max ${alcohol.maxDrinks} on a day). ` +
        `Alcohol is in play — compare next-day HRV/RHR/steps before calling the window “fit idle.” ` +
        lagBlurb(lags),
    })
  }

  // --- H1b: RHR drinking ladder (when Anchor drinks are thin / absent) ---
  const rhrStats = rhrDrinkWindowStats(daily)
  const anchorStrong =
    alcohol && (alcohol.bingeDays > 0 || alcohol.maxDrinks >= 10 || alcohol.totalDrinks >= 20)
  if (!anchorStrong && rhrStats.heavyStackDays > 0) {
    let conf = 0.62 + Math.min(0.25, rhrStats.heavyStackDays * 0.06)
    if (noActivity) conf += 0.08
    if (rhrStats.shareHeavy >= 0.3) conf += 0.08
    hypotheses.push({
      id: 'rhr_heavy_stack',
      label: 'Very high resting HR — heavy drinking and/or other load',
      confidence: Math.min(0.92, Math.round(conf * 100) / 100),
      priority: 1,
      text:
        `${rhrStats.heavyStackDays} morning(s) with resting HR ≥55 (band: very bad). ` +
        `Above 54 bpm on this ladder means heavy drinking and/or other physiological load — not a fitness peak. ` +
        (rhrStats.exampleHeavyDates?.length
          ? `Examples: ${rhrStats.exampleHeavyDates.join(', ')}. `
          : '') +
        `Log Anchor alcoholDrinks the same night so the engine can confirm; until then treat these mornings as contaminated.`,
    })
  } else if (!anchorStrong && rhrStats.likelyDrinkingDays > 0) {
    let conf = 0.5 + Math.min(0.25, rhrStats.likelyDrinkingDays * 0.05)
    if (noActivity) conf += 0.05
    hypotheses.push({
      id: 'rhr_likely_drinking',
      label: 'Elevated resting HR — likely drinking',
      confidence: Math.min(0.85, Math.round(conf * 100) / 100),
      priority: 2,
      text:
        `${rhrStats.likelyDrinkingDays} morning(s) with resting HR ≥50 (above 49 = definitely been drinking on this ladder). ` +
        (rhrStats.exampleLikelyDates?.length
          ? `Examples: ${rhrStats.exampleLikelyDates.join(', ')}. `
          : '') +
        `Confirm with Anchor drink counts; do not read these days as clean recovery.`,
    })
  }

  // --- H2: Idle under-load / recovery illusion (only if alcohol NOT dominant) ---
  const alcoholDominant = hypotheses.some(
    h =>
      (h.id === 'alcohol_binge_stack' && h.confidence >= 0.7) ||
      (h.id === 'rhr_heavy_stack' && h.confidence >= 0.7),
  )
  const rhrSuggestsDrink =
    rhrStats.likelyDrinkingDays > 0 || rhrStats.heavyStackDays > 0 || (latestRhr != null && latestRhr >= 50)
  if (noActivity && latestRhr != null && latestRhr <= 56 && !rhrSuggestsDrink) {
    const conf = alcoholDominant ? 0.25 : 0.7
    hypotheses.push({
      id: 'idle_low_rhr',
      label: 'Idle under-load (low RHR without training)',
      confidence: conf,
      priority: alcoholDominant ? 4 : 2,
      text: alcoholDominant
        ? `Low RHR (~${Math.round(latestRhr)}) with no sessions is the *secondary* read here. ` +
          `Once binge/heavy drinking is present, “recovery illusion from not training” is usually just the hangover idle ` +
          `pattern — you did not train because you drank / recovered from drinking, not because you strategically deloaded. ` +
          `Do not award a fitness medal.`
        : `Night / resting HR ~${Math.round(latestRhr)} with almost no logged activity looks calm because demand was calm. ` +
          `Without Anchor drink evidence, this defaults to under-loading. Log drinks on Anchor so alcohol is not missed.`,
    })
  }

  // --- H3: Autonomic rebound mismatch (low RHR despite binge) ---
  if (alcohol?.maxDrinks >= 10 && latestRhr != null && latestRhr <= 56) {
    hypotheses.push({
      id: 'rhr_alcohol_mismatch',
      label: 'Low RHR despite binge — timing / averaging mismatch',
      confidence: 0.72,
      priority: 1,
      text:
        `You can post a binge (e.g. ~${alcohol.maxDrinks} drinks) and still see a resting HR around ${Math.round(latestRhr)}. ` +
        `That does **not** mean alcohol was harmless. Common reasons: (1) Garmin “resting HR” / night HR is an overnight ` +
        `aggregate that can still look low if sleep HR dips, while daytime hangover tachycardia is missed; ` +
        `(2) the 53 bpm figure is a multi-day average diluted by clean nights; (3) residual aerobic fitness keeps the ` +
        `floor low even when HRV and next-day readiness are wrecked; (4) drink day vs metric day timezone/date skew. ` +
        `Trust the *lag panel*: next-day HRV, stress, steps, and whether you trained — not a single flattering RHR. ` +
        lagBlurb(lags, true),
    })
  }

  // --- H4: Sleep debt ---
  if (domains?.sleep && domains.sleep.avgHours < 6.5) {
    hypotheses.push({
      id: 'sleep_debt',
      label: 'Sleep debt',
      confidence: domains.sleep.shortNights >= 5 ? 0.8 : 0.55,
      priority: 3,
      text:
        `Sleep avg ${domains.sleep.avgHours}h with ${domains.sleep.shortNights} short nights. ` +
        (alcohol?.drinkDays
          ? `Alcohol fragments sleep architecture even when hours look acceptable — pair this with drink days.`
          : `Fix the sleep floor before adding intensity.`),
    })
  }

  // --- H5: Stress stack ---
  if (domains?.stress && domains.stress.avg >= 40) {
    hypotheses.push({
      id: 'stress_stack',
      label: 'Elevated stress load',
      confidence: domains.stress.highDays >= 5 ? 0.75 : 0.5,
      priority: 3,
      text: `Stress avg ${domains.stress.avg} with ${domains.stress.highDays} high days. Alcohol and late nights amplify this.`,
    })
  }

  // --- H6: Late nights ---
  if (alcohol?.lateNightDays >= 3) {
    hypotheses.push({
      id: 'late_nights',
      label: 'Late-night pattern',
      confidence: 0.55,
      priority: 3,
      text: `${alcohol.lateNightDays} late_night tags in window — circadian debt stacks with drinking and kills next-day training probability.`,
    })
  }

  hypotheses.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence)
  return hypotheses
}

function lagBlurb(lags, binge = false) {
  const d = binge ? lags?.deltasBingeVsClean : lags?.deltasDrinkVsClean
  if (!d) return ''
  const parts = []
  if (d.restingHr != null) parts.push(`RHR ${d.restingHr > 0 ? '+' : ''}${d.restingHr} bpm`)
  if (d.hrv != null) parts.push(`HRV ${d.hrv > 0 ? '+' : ''}${d.hrv}`)
  if (d.stress != null) parts.push(`stress ${d.stress > 0 ? '+' : ''}${d.stress}`)
  if (d.sleepHours != null) parts.push(`sleep ${d.sleepHours > 0 ? '+' : ''}${d.sleepHours}h`)
  if (d.steps != null) parts.push(`steps ${d.steps > 0 ? '+' : ''}${Math.round(d.steps)}`)
  if (!parts.length) return 'Lag sample too thin to quantify drink→next-day deltas yet.'
  return `Next-day delta vs clean baseline: ${parts.join(', ')}.`
}

function buildAlcoholHypothesisText({ alcohol, lags, domains, noActivity, latestRhr, example }) {
  const paras = []
  paras.push(
    `Anchor shows serious drinking in this window: ${alcohol.drinkDays} drink day(s), ` +
      `${alcohol.totalDrinks} drinks total, max ${alcohol.maxDrinks} on ${alcohol.maxDrinkDate || 'a single day'}` +
      (alcohol.bingeDays ? ` (${alcohol.bingeDays} binge day(s) at 10+ drinks)` : '') +
      `. A session like ~15 beers is a physiological event, not a lifestyle footnote.`,
  )

  paras.push(
    `What heavy alcohol does next day (expected): HRV down, resting HR up (often +5–15 bpm vs your baseline), ` +
      `sleep more fragmented, stress score higher, steps/training probability near zero. ` +
      `That idle day is hangover economics — not a planned deload.`,
  )

  if (noActivity) {
    paras.push(
      `Activity matches the drink story: ${domains.activity.sessions} sessions, ` +
        `${Math.round((domains.activity.zeroActivityShare || 0) * 100)}% zero-activity days. ` +
        `The correct causal order is usually: binge → poor recovery night → no training — ` +
        `not “I am so recovered my RHR is 53 so I skipped the gym.”`,
    )
  }

  if (latestRhr != null && latestRhr <= 56) {
    paras.push(
      `About resting HR ~${Math.round(latestRhr)} after (or around) heavy drinking: do not read it as proof the binge was fine. ` +
        `Overnight RHR can still print low while daytime hangover, HRV collapse, and zero output tell the real story. ` +
        `If the 53 is a night reading on the drink calendar date, it may even precede peak alcohol effect. ` +
        lagBlurb(lags, alcohol.maxDrinks >= 10),
    )
  } else if (latestRhr != null) {
    paras.push(
      `Resting HR latest/avg around ${Math.round(latestRhr)} fits an alcohol rebound better than a fitness peak. ` +
        lagBlurb(lags, alcohol.maxDrinks >= 10),
    )
  }

  if (example) {
    const n = example.next
    paras.push(
      `Case file — ${example.date}: ${example.drinks} drinks` +
        (n
          ? `; next day ${n.date}: RHR ${n.restingHr ?? '—'}, HRV ${n.hrv ?? '—'}, stress ${n.stress ?? '—'}, ` +
            `sleep ${n.sleepHours ?? '—'}h, sessions ${n.activityCount ?? 0}, steps ${n.steps ?? '—'}`
          : ' (no next-day Garmin row to pair)') +
        `.`,
    )
  }

  paras.push(
    `Prescription for this causal read: protect 7+ clean Anchor days before judging fitness trends; ` +
      `re-enter with easy aerobic work only after a clean sleep + HRV that is not cratered vs your clean baseline; ` +
      `log drink counts the same night so the engine can keep ranking alcohol above flattering RHR numbers.`,
  )

  return paras.join(' ')
}

/**
 * Full causal analysis for a clipped daily window (already may include confounder fields).
 */
export function analyzeCausal(daily, confounderTables = {}) {
  const enriched =
    daily.length && daily[0].drinkLoad != null
      ? daily
      : attachConfounders(daily, confounderTables)

  const alcohol = alcoholWindowStats(enriched)
  const lags = lagEffects(enriched)
  const rhrLadder = rhrDrinkWindowStats(enriched)

  // domains-lite for hypothesis ranking (caller usually passes full domains)
  const domains = confounderTables.domains || null

  const hypotheses = rankHypotheses({
    daily: enriched,
    domains: domains || {
      activity: {
        sessions: enriched.reduce((s, d) => s + (d.activityCount || 0), 0),
        activeDays: enriched.filter(d => (d.activityCount || 0) > 0).length,
        zeroActivityShare:
          enriched.length === 0
            ? 0
            : enriched.filter(d => (d.activityCount || 0) === 0).length / enriched.length,
      },
      restingHr: {
        latest: [...enriched].reverse().find(d => d.restingHr != null)?.restingHr ?? null,
        avg: avg(enriched.map(d => d.restingHr)),
      },
      sleep: null,
      stress: null,
    },
    alcohol,
    lags,
  })

  const top = hypotheses[0] || null
  const narrative = buildCausalNarrative({ alcohol, lags, hypotheses, enriched, rhrLadder })

  const patterns = hypotheses.slice(0, 6).map(h => ({
    id: h.id,
    severity: h.confidence >= 0.7 ? 'high' : h.confidence >= 0.45 ? 'moderate' : 'info',
    title: `${h.label} (${Math.round(h.confidence * 100)}%)`,
    text: h.text,
  }))

  return {
    alcohol,
    rhrLadder,
    lags,
    hypotheses,
    topHypothesis: top,
    narrative,
    patterns,
    enrichedDaily: enriched,
  }
}

export function buildCausalNarrative({ alcohol, lags, hypotheses, enriched, rhrLadder }) {
  const paras = []

  paras.push(
    `Causal engine for this window (${alcohol.daysInWindow} days with signals). ` +
      `Drink days ${alcohol.drinkDays}/${alcohol.daysInWindow} · total drinks ${alcohol.totalDrinks} · ` +
      `max ${alcohol.maxDrinks}` +
      (alcohol.maxDrinkDate ? ` on ${alcohol.maxDrinkDate}` : '') +
      ` · binge days ${alcohol.bingeDays}.`,
  )

  if (rhrLadder && (rhrLadder.likelyDrinkingDays > 0 || rhrLadder.heavyStackDays > 0)) {
    paras.push(
      `RHR drinking ladder: ${rhrLadder.likelyDrinkingDays} day(s) ≥50 (likely drinking), ` +
        `${rhrLadder.heavyStackDays} day(s) ≥55 (heavy stack). ` +
        `Thresholds: above 49 = drinking signal; above 54 = very bad — heavy drinking and/or other load.`,
    )
  }

  if (alcohol.maxDrinks >= 10) {
    paras.push(
      `A max of ${alcohol.maxDrinks} drinks is binge territory (≈15 beers qualifies). ` +
        `At that dose the dominant story is almost never “athletic calm.” It is acute toxin load → autonomic noise → ` +
        `next-day underperformance. If training is zero around that date, alcohol is the leading explanation until proven otherwise.`,
    )
  } else if (alcohol.drinkDays === 0) {
    paras.push(
      `No Anchor/weight drink counts in this window. If you actually drank (e.g. a 15-beer night) and it is not logged, ` +
        `the engine will wrongly prefer idle/RHR stories — log RecoveryEntry.alcoholDrinks the same calendar night.`,
    )
  }

  const d = lags.deltasBingeVsClean?.restingHr != null ? lags.deltasBingeVsClean : lags.deltasDrinkVsClean
  if (lags.afterDrink.n >= 3 && lags.afterClean.n >= 3) {
    paras.push(
      `Lag study (next day after drinks vs clean baseline): ` +
        `after-drink n=${lags.afterDrink.n}, clean n=${lags.afterClean.n}. ` +
        `ΔRHR ${fmtDelta(d.restingHr)} · ΔHRV ${fmtDelta(d.hrv)} · Δstress ${fmtDelta(d.stress)} · ` +
        `Δsleep ${fmtDelta(d.sleepHours)}h · Δsteps ${fmtDelta(d.steps, true)}. ` +
        `After-drink zero-activity share ${Math.round((lags.afterDrink.zeroActivityShare || 0) * 100)}% vs clean ` +
        `${Math.round((lags.afterClean.zeroActivityShare || 0) * 100)}%.`,
    )
  } else {
    paras.push(
      `Lag study underpowered (after-drink n=${lags.afterDrink.n}, clean n=${lags.afterClean.n}). ` +
        `Need more paired days — keep logging Anchor + Garmin.`,
    )
  }

  for (const h of hypotheses.slice(0, 4)) {
    paras.push(`[${Math.round(h.confidence * 100)}% · ${h.label}] ${h.text}`)
  }

  const recentBinge = [...enriched].reverse().find(d => d.alcoholDrinks >= 10)
  if (recentBinge) {
    paras.push(
      `Most recent binge-scale day in window: ${recentBinge.date} (${recentBinge.alcoholDrinks} drinks). ` +
        `Re-read the following 48h of HRV/RHR/steps/activity as contaminated by that event.`,
    )
  }

  return paras.join('\n\n')
}

function fmtDelta(v, asInt = false) {
  if (v == null || Number.isNaN(v)) return 'n/a'
  const n = asInt ? Math.round(v) : v
  return `${n > 0 ? '+' : ''}${n}`
}

/**
 * Load confounder tables from Prisma (safe if models missing).
 */
export async function loadConfounders(prisma, { from, to } = {}) {
  const range = from && to ? { gte: from, lte: to } : undefined
  const whereDate = range ? { date: range } : {}
  const safe = async (label, fn) => {
    try {
      return await fn()
    } catch (err) {
      console.warn(`[period-causal] ${label} skipped:`, err?.message?.split('\n')[0] || err)
      return []
    }
  }

  const [recoveries, dayEntries, weights] = await Promise.all([
    safe('recovery', () =>
      prisma.recoveryEntry.findMany({
        where: whereDate,
        orderBy: { date: 'asc' },
        select: {
          date: true,
          alcoholDrinks: true,
          cocaineUsed: true,
          escortUsed: true,
          mood: true,
          energy: true,
          sleepHours: true,
        },
      }),
    ),
    safe('dayEntry', () =>
      prisma.dayEntry.findMany({
        where: whereDate,
        select: { date: true, mode: true, tags: true },
      }),
    ),
    safe('weightAlcohol', () =>
      prisma.weightEntry.findMany({
        where: whereDate,
        select: {
          date: true,
          alcoholUnits: true,
          hoursSinceAlcohol: true,
          illnessDay: true,
        },
      }),
    ),
  ])

  return { recoveries, dayEntries, weights }
}
