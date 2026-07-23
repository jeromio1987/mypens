// =============================================================================
// Engine stress-test harness — Garmin Analysis + Period + Causal
//
// Runs against multi-source fixtures (Garmin / Strava / Tanita / Anchor) and
// returns a structured pass/fail report. Pure — no DB required.
// =============================================================================

import { analyzeGarmin } from './garminAnalyze.mjs'
import { analyzePeriods, buildDailySignals } from './periodAnalyze.mjs'
import { analyzeCausal, attachConfounders } from './periodCausal.mjs'
import { buildMultiSourceFixture } from './engineFixtures.mjs'

function check(id, ok, detail) {
  return { id, ok: Boolean(ok), detail: detail || '' }
}

/**
 * @param {object} [fixture] - optional override; default = buildMultiSourceFixture()
 */
export function runEngineStressTest(fixture) {
  const data = fixture || buildMultiSourceFixture()
  const checks = []

  // ── Garmin Analysis Engine ───────────────────────────────────────────────
  const garmin = analyzeGarmin({
    sleeps: data.sleeps,
    weights: data.weights,
    trainings: data.trainings,
    activities: data.activities,
    metrics: data.metrics,
    weekOf: data.meta?.start,
    weekEnd: data.meta?.end,
  })

  checks.push(
    check(
      'garmin.inventory.sleep',
      garmin.inventory.sleepNights >= 90,
      `sleep nights=${garmin.inventory.sleepNights}`,
    ),
    check(
      'garmin.inventory.activities',
      garmin.inventory.garminActivities >= 20,
      `garmin activities=${garmin.inventory.garminActivities}`,
    ),
    check(
      'garmin.inventory.training',
      garmin.inventory.trainingEntries >= 15,
      `training ledger=${garmin.inventory.trainingEntries}`,
    ),
    check(
      'garmin.inventory.weight',
      garmin.inventory.weightEntries >= 30,
      `weight entries=${garmin.inventory.weightEntries}`,
    ),
    check(
      'garmin.inventory.wellness',
      garmin.inventory.wellnessPoints >= 400,
      `wellness points=${garmin.inventory.wellnessPoints}`,
    ),
    check(
      'garmin.strava_source',
      (garmin.domains.training?.stravaSessions || 0) >= 15,
      `strava sessions=${garmin.domains.training?.stravaSessions}`,
    ),
    check(
      'garmin.tanita_bodyfat',
      garmin.domains.weight?.latestBodyFatPct != null,
      `latest BF%=${garmin.domains.weight?.latestBodyFatPct}`,
    ),
    check(
      'garmin.coverage',
      garmin.coverageScore >= 6,
      `coverage ${garmin.coverageScore}/${garmin.coverageMax || 7}`,
    ),
    check(
      'garmin.findings_mention_strava',
      garmin.findings.some(f => /strava|training ledger/i.test(f)) ||
        (garmin.wins || []).some(w => /strava/i.test(w)),
      `findings=${garmin.findings.length}`,
    ),
    check(
      'garmin.findings_mention_bodycomp',
      garmin.findings.some(f => /body comp|body-fat|BF /i.test(f)),
      'body-comp finding present',
    ),
    check(
      'garmin.cross_stress_sleep',
      garmin.crossLinks.stressVsSleep != null,
      `stress↔sleep r=${garmin.crossLinks.stressVsSleep}`,
    ),
  )

  // ── Period Review (+ Strava counted as activity) ─────────────────────────
  const periods = analyzePeriods(
    {
      sleeps: data.sleeps,
      metrics: data.metrics,
      activities: data.activities,
      trainings: data.trainings,
      weights: data.weights,
      recoveries: data.recoveries,
      dayEntries: data.dayEntries,
    },
    { asOf: data.asOf || data.meta?.end, horizonsMonths: [1, 3, 6, 12] },
  )

  const daily = buildDailySignals({
    sleeps: data.sleeps,
    metrics: data.metrics,
    activities: data.activities,
    trainings: data.trainings,
  })
  const stravaBoostedDays = daily.filter(d => d.activityCount > 0).length

  checks.push(
    check('period.headline', Boolean(periods.headline), periods.headline?.slice(0, 120)),
    check('period.horizons', periods.horizons.length >= 4, `horizons=${periods.horizons.length}`),
    check(
      'period.strava_counts_as_activity',
      stravaBoostedDays >= 30,
      `active days (Garmin+Strava)=${stravaBoostedDays}`,
    ),
    check(
      'period.deep_analysis_length',
      (periods.deepAnalysis || '').length > 400,
      `deepAnalysis chars=${(periods.deepAnalysis || '').length}`,
    ),
  )

  const h1 = periods.horizons.find(h => h.months === 1)
  const h3 = periods.horizons.find(h => h.months === 3)
  const h12 = periods.horizons.find(h => h.months === 12)

  checks.push(
    check('period.h1.verdict', Boolean(h1?.verdict), `h1=${h1?.verdict} score=${h1?.score}`),
    check('period.h3.verdict', Boolean(h3?.verdict), `h3=${h3?.verdict} score=${h3?.score}`),
    check('period.h12.verdict', Boolean(h12?.verdict), `h12=${h12?.verdict} score=${h12?.score}`),
    check(
      'period.h12.has_analysis',
      (h12?.analysis || '').length > 200,
      `h12 analysis chars=${(h12?.analysis || '').length}`,
    ),
  )

  // ── Causal: binge must outrank idle-RHR illusion ─────────────────────────
  const bingeDate = data.meta?.bingeDate || data.recoveries?.[0]?.date
  const causalWindowDays = daily.slice(-90)
  const causal = analyzeCausal(causalWindowDays, {
    recoveries: data.recoveries,
    dayEntries: data.dayEntries,
    weights: data.weights,
    domains: h1?.domains || h3?.domains || {},
  })

  checks.push(
    check(
      'causal.top_is_alcohol_binge',
      causal.topHypothesis?.id === 'alcohol_binge_stack',
      `top=${causal.topHypothesis?.id} conf=${causal.topHypothesis?.confidence}`,
    ),
    check(
      'causal.narrative_mentions_binge',
      /15|binge|alcohol/i.test(causal.narrative || ''),
      (causal.narrative || '').slice(0, 160),
    ),
    check(
      'period.horizon_causal_alcohol',
      h3?.causal?.topHypothesis?.id === 'alcohol_binge_stack' ||
        h12?.causal?.topHypothesis?.id === 'alcohol_binge_stack' ||
        periods.topHypothesis?.id === 'alcohol_binge_stack',
      `period top=${periods.topHypothesis?.id || h3?.causal?.topHypothesis?.id}`,
    ),
    check(
      'causal.attach_binge_flag',
      attachConfounders(daily, {
        recoveries: data.recoveries,
        dayEntries: data.dayEntries,
        weights: data.weights,
      }).some(x => x.date === bingeDate && x.isBinge),
      `bingeDate=${bingeDate}`,
    ),
  )

  // ── Regression: engines must NOT claim "no data" when fixture is rich ────
  checks.push(
    check(
      'no_false_empty_garmin',
      !/no garmin-derived data|no usable rows/i.test(garmin.summary || ''),
      garmin.summary,
    ),
    check(
      'no_false_empty_period',
      !/not enough garmin\/health rows/i.test(periods.headline || ''),
      periods.headline,
    ),
  )

  const passed = checks.filter(c => c.ok).length
  const failed = checks.filter(c => !c.ok)

  return {
    asOf: data.asOf || data.meta?.end,
    meta: data.meta,
    summary: {
      total: checks.length,
      passed,
      failed: failed.length,
      passRate: Math.round((passed / checks.length) * 1000) / 10,
    },
    checks,
    failed,
    garmin,
    periods: {
      headline: periods.headline,
      topHypothesis: periods.topHypothesis,
      dataSpan: periods.dataSpan,
      horizons: periods.horizons.map(h => ({
        label: h.label,
        months: h.months,
        verdict: h.verdict,
        score: h.score,
        weeks: h.weeks,
        topPattern: h.patterns?.[0]?.id || null,
        causal: h.causal?.topHypothesis?.id || null,
        analysisPreview: (h.analysis || '').slice(0, 280),
      })),
      deepAnalysis: periods.deepAnalysis,
      causalNarrative: periods.causalNarrative,
    },
    causal: {
      topHypothesis: causal.topHypothesis,
      narrative: causal.narrative,
      alcohol: causal.alcohol,
    },
  }
}

export function stressTestToMarkdown(report) {
  const lines = [
    '# Engine stress test — Garmin · Strava · Tanita · Anchor',
    '',
    `_As of ${report.asOf}_`,
    '',
    `**Result: ${report.summary.passed}/${report.summary.total} checks passed (${report.summary.passRate}%)**`,
    '',
    '## Fixture',
    '```json',
    JSON.stringify(report.meta, null, 2),
    '```',
    '',
    '## Checks',
    ...report.checks.map(c => `- ${c.ok ? 'PASS' : 'FAIL'} \`${c.id}\` — ${c.detail}`),
    '',
  ]

  if (report.failed.length) {
    lines.push('## Failures', ...report.failed.map(c => `- **${c.id}**: ${c.detail}`), '')
  }

  lines.push(
    '## Garmin Analysis Engine',
    `Coverage: ${report.garmin.coverageScore}/${report.garmin.coverageMax || 7}`,
    '',
    '### Inventory',
    '```json',
    JSON.stringify(report.garmin.inventory, null, 2),
    '```',
    '',
    '### Findings',
    ...(report.garmin.findings || []).map(f => `- ${f}`),
    '',
    '### Risks',
    ...(report.garmin.risks?.length ? report.garmin.risks.map(r => `- ${r}`) : ['- _none_']),
    '',
    '### Wins',
    ...(report.garmin.wins?.length ? report.garmin.wins.map(w => `- ${w}`) : ['- _none_']),
    '',
    '### Domains (abbrev)',
    '```json',
    JSON.stringify(
      {
        sleep: report.garmin.domains.sleep,
        stress: report.garmin.domains.stress,
        hrv: report.garmin.domains.hrv,
        restingHr: report.garmin.domains.restingHr,
        activities: report.garmin.domains.activities,
        training: report.garmin.domains.training,
        weight: report.garmin.domains.weight,
      },
      null,
      2,
    ),
    '```',
    '',
    '## Period Review',
    report.periods.headline,
    '',
    '### Horizons',
    ...report.periods.horizons.map(
      h =>
        `- **${h.label}**: ${h.verdict ?? '—'} (${h.score ?? '—'}/100, ${h.weeks ?? 0} weeks)` +
        (h.causal ? ` — cause: ${h.causal}` : '') +
        (h.topPattern ? ` — pattern: ${h.topPattern}` : ''),
    ),
    '',
    '### Deep analysis',
    report.periods.deepAnalysis || '_none_',
    '',
    '## Causal engine',
    report.causal.topHypothesis
      ? `**Leading:** ${report.causal.topHypothesis.label} (${Math.round((report.causal.topHypothesis.confidence || 0) * 100)}%)`
      : '_no hypothesis_',
    '',
    report.causal.narrative || '_none_',
    '',
  )

  return lines.join('\n')
}
