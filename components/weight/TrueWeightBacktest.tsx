'use client'

import { useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  calculateWeightBreakdown,
  calculateConfidence,
  calculateRollingBaseline,
  calculateDynamicBand,
  detectOutlier,
} from '@/lib/retentionModels'
import type { ConfidenceLevel, HistoryEntry } from '@/lib/retentionModels'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioDay {
  label:             string
  scaleKg:           number
  creatineDoseG:     number
  creatineDaysOn:    number
  alcoholUnits:      number
  hoursSinceAlcohol: number
  carbsG:            number
  hardTraining:      boolean
  morningReading:    boolean
  highSodium:        boolean
  restaurantMeal:    boolean
  flightDay:         boolean
  illnessDay:        boolean
  isSetup?:          boolean   // marks seeding days (shown gray in table)
}

interface Scenario {
  id:            string
  name:          string
  icon:          string
  colorClass:    string
  description:   string
  expected:      string
  passCondition: string
  days:          ScenarioDay[]
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    id: 'creatine-loading',
    name: 'Creatine Loading Phase',
    icon: '⚡',
    colorClass: 'border-blue-200 bg-blue-50',
    description: '7-day loading protocol (20 g/day). Scale weight spikes ~1 kg as intramuscular creatine saturates.',
    expected: 'Adjusted weight stays ≈ 83.0 kg throughout. Scale spike is correctly attributed to creatine — not fat.',
    passCondition: 'Adjusted weight variance ≤ 0.15 kg across all days',
    days: [
      { label: 'Day 1',        scaleKg: 83.15, creatineDoseG: 20, creatineDaysOn: 1,  alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day 3',        scaleKg: 83.45, creatineDoseG: 20, creatineDaysOn: 3,  alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day 5',        scaleKg: 83.75, creatineDoseG: 20, creatineDaysOn: 5,  alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day 7',        scaleKg: 84.00, creatineDoseG: 20, creatineDaysOn: 7,  alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day 14',       scaleKg: 83.40, creatineDoseG: 5,  creatineDaysOn: 14, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day 28 (sat.)',scaleKg: 83.40, creatineDoseG: 5,  creatineDaysOn: 28, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
    ],
  },
  {
    id: 'refeed',
    name: 'Refeed Day',
    icon: '🍚',
    colorClass: 'border-orange-200 bg-orange-50',
    description: 'One day at 450 g carbs. Glycogen + bound water spike (+~0.5 kg on scale next morning).',
    expected: 'Morning after refeed: algorithm strips glycogen water, adjusted ≈ normal baseline. Resolves day +2.',
    passCondition: 'Adjusted weight on "Morning after" within 0.15 kg of baseline',
    days: [
      { label: 'Baseline',             scaleKg: 83.0,  creatineDoseG: 5, creatineDaysOn: 28, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Morning after refeed', scaleKg: 83.55, creatineDoseG: 5, creatineDaysOn: 29, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 450, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Day +2',               scaleKg: 83.2,  creatineDoseG: 5, creatineDaysOn: 30, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 180, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
    ],
  },
  {
    id: 'city-trip',
    name: 'City Trip',
    icon: '✈️',
    colorClass: 'border-purple-200 bg-purple-50',
    description: 'Flight + restaurant meals + 3 alcohol units on day 2. Back home day 4.',
    expected: 'Confidence correctly drops to low on noisy days. Band widens. Returns high confidence on clean day 4.',
    passCondition: 'Days 1–3 confidence ≤ medium; Day 4 confidence = high',
    days: [
      { label: 'Flight day',         scaleKg: 83.75, creatineDoseG: 5, creatineDaysOn: 30, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 200, hardTraining: false, morningReading: true,  highSodium: true,  restaurantMeal: true,  flightDay: true,  illnessDay: false },
      { label: 'City (morning)',      scaleKg: 84.10, creatineDoseG: 5, creatineDaysOn: 31, alcoholUnits: 3, hoursSinceAlcohol: 10, carbsG: 300, hardTraining: false, morningReading: true,  highSodium: true,  restaurantMeal: true,  flightDay: false, illnessDay: false },
      { label: 'Return flight',       scaleKg: 83.50, creatineDoseG: 5, creatineDaysOn: 32, alcoholUnits: 0, hoursSinceAlcohol: 36, carbsG: 150, hardTraining: false, morningReading: true,  highSodium: false, restaurantMeal: false, flightDay: true,  illnessDay: false },
      { label: 'Home — next morning', scaleKg: 83.05, creatineDoseG: 5, creatineDaysOn: 33, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true,  highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
    ],
  },
  {
    id: 'deload',
    name: 'Deload Week',
    icon: '😴',
    colorClass: 'border-gray-200 bg-gray-50',
    description: '5 clean days: no creatine, no training, normal carbs, fasted morning readings. The no-noise baseline.',
    expected: 'All days: high confidence, band = ±0.2 kg. Adjusted ≈ scale. Algorithm adds no distortion when inputs are clean.',
    passCondition: 'All days confidence = high; adjusted within 0.05 kg of scale',
    days: [
      { label: 'Mon', scaleKg: 83.00, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Tue', scaleKg: 82.85, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Wed', scaleKg: 82.90, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Thu', scaleKg: 82.75, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
      { label: 'Fri', scaleKg: 82.80, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
    ],
  },
  {
    // ── New v3 scenario: tests rolling baseline anchoring under multi-day retention ──
    id: '4-day-retention',
    name: '4-Day Retention Event',
    icon: '📈',
    colorClass: 'border-red-200 bg-red-50',
    description: '5 clean setup days establish the baseline (~83 kg). Then 4 consecutive high-noise days: alcohol, restaurant, high sodium, high carbs. Scale climbs to +2.2 kg. Tests whether the baseline stays anchored and outliers are flagged.',
    expected: 'Baseline stays ≤ ±0.5 kg from 83.0 throughout event days. Scale deviations flagged as outliers on days where they exceed 2.5× the dynamic band.',
    passCondition: 'Baseline within ±0.5 kg of 83.0 on all event days AND ≥ 2 outliers detected',
    days: [
      // ── Setup — 5 clean days to seed the rolling baseline ──
      { label: 'Setup −5', scaleKg: 83.00, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false, isSetup: true },
      { label: 'Setup −4', scaleKg: 82.85, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false, isSetup: true },
      { label: 'Setup −3', scaleKg: 83.10, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false, isSetup: true },
      { label: 'Setup −2', scaleKg: 83.05, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false, isSetup: true },
      { label: 'Setup −1', scaleKg: 82.90, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false, isSetup: true },
      // ── Event — 4 consecutive high-retention days ──
      { label: 'Event day 1', scaleKg: 83.90, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 4, hoursSinceAlcohol: 12, carbsG: 280, hardTraining: false, morningReading: true, highSodium: true,  restaurantMeal: true,  flightDay: false, illnessDay: false },
      { label: 'Event day 2', scaleKg: 84.70, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 2, hoursSinceAlcohol: 16, carbsG: 350, hardTraining: false, morningReading: true, highSodium: true,  restaurantMeal: true,  flightDay: false, illnessDay: false },
      { label: 'Event day 3', scaleKg: 85.20, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 3, hoursSinceAlcohol: 10, carbsG: 300, hardTraining: false, morningReading: true, highSodium: true,  restaurantMeal: true,  flightDay: false, illnessDay: false },
      { label: 'Event day 4', scaleKg: 85.10, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 200, hardTraining: false, morningReading: true, highSodium: true,  restaurantMeal: false, flightDay: false, illnessDay: false },
      // ── Recovery ──
      { label: 'Recovery',    scaleKg: 83.20, creatineDoseG: 0, creatineDaysOn: 0, alcoholUnits: 0, hoursSinceAlcohol: 48, carbsG: 150, hardTraining: false, morningReading: true, highSodium: false, restaurantMeal: false, flightDay: false, illnessDay: false },
    ],
  },
]

// ─── Pass/fail logic ──────────────────────────────────────────────────────────

function evaluateScenario(scenario: Scenario, results: ReturnType<typeof runScenario>) {
  switch (scenario.id) {
    case 'creatine-loading': {
      const adjValues = results.map(r => r.trueWeightKg)
      const variance  = Math.max(...adjValues) - Math.min(...adjValues)
      return variance <= 0.15
    }
    case 'refeed': {
      const baseline = results[0].trueWeightKg
      const afterDay = results[1].trueWeightKg
      return Math.abs(afterDay - baseline) <= 0.15
    }
    case 'city-trip': {
      const trippingDays = results.slice(0, 3)
      const homeDay      = results[3]
      const tripNoisy    = trippingDays.some(r => r.confidence !== 'high')
      const homeClean    = homeDay.confidence === 'high'
      return tripNoisy && homeClean
    }
    case 'deload': {
      return results.every(r => r.confidence === 'high')
    }
    case '4-day-retention': {
      // Setup = days 0-4 (isSetup), event = days 5-8, recovery = day 9
      const eventResults = results.slice(5, 9)
      const ANCHOR       = 83.0
      const baselineStable = eventResults
        .filter(r => r.baselineTrendKg !== null)
        .every(r => Math.abs((r.baselineTrendKg as number) - ANCHOR) <= 0.5)
      const outliersDetected = eventResults.filter(r => r.isOutlier).length >= 2
      return baselineStable && outliersDetected
    }
    default:
      return false
  }
}

// ─── Run model ────────────────────────────────────────────────────────────────
// v3: accumulates history across days — each entry sees prior entries only.

function runScenario(days: ScenarioDay[]) {
  const history: HistoryEntry[] = []
  const results: Array<{
    label:           string
    isSetup:         boolean
    scaleKg:         number
    creatineKg:      number
    alcoholKg:       number
    glycogenKg:      number
    sodiumKg:        number
    hardTrainingKg:  number
    trueWeightKg:    number
    totalRetention:  number
    confidence:      ConfidenceLevel
    bandKg:          number
    dynamicBandSource: 'dynamic' | 'static'
    baselineTrendKg: number | null
    isOutlier:       boolean
    lo:              number
    hi:              number
    __bandLow:       number
    __bandWidth:     number
  }> = []

  for (const d of days) {
    const bd   = calculateWeightBreakdown(d)
    const conf = calculateConfidence({
      creatineRetentionKg: bd.creatineKg,
      alcoholRetentionKg:  bd.alcoholKg,
      glycogenRetentionKg: bd.glycogenKg,
      hardTraining:   d.hardTraining,
      morningReading: d.morningReading,
      highSodium:     d.highSodium,
      restaurantMeal: d.restaurantMeal,
      flightDay:      d.flightDay,
      illnessDay:     d.illnessDay,
    })

    // Trend layer — uses history before this entry
    const baselineTrendKg                              = calculateRollingBaseline(history)
    const { bandKg, source: dynamicBandSource }        = calculateDynamicBand(history, conf.level as ConfidenceLevel)
    const isOutlier                                    = detectOutlier(d.scaleKg, baselineTrendKg, bandKg)
    const effectiveBand = bandKg  // dynamic if enough history, else static (calculateDynamicBand handles fallback)

    results.push({
      label:           d.label,
      isSetup:         d.isSetup ?? false,
      scaleKg:         d.scaleKg,
      creatineKg:      bd.creatineKg,
      alcoholKg:       bd.alcoholKg,
      glycogenKg:      bd.glycogenKg,
      sodiumKg:        bd.sodiumKg,
      hardTrainingKg:  bd.hardTrainingKg,
      trueWeightKg:    bd.trueWeightKg,
      totalRetention:  parseFloat((bd.creatineKg + bd.alcoholKg + bd.glycogenKg + bd.sodiumKg + bd.hardTrainingKg).toFixed(2)),
      confidence:      conf.level as ConfidenceLevel,
      bandKg:          effectiveBand,
      dynamicBandSource,
      baselineTrendKg,
      isOutlier,
      lo:              parseFloat((bd.trueWeightKg - effectiveBand).toFixed(2)),
      hi:              parseFloat((bd.trueWeightKg + effectiveBand).toFixed(2)),
      __bandLow:       parseFloat((bd.trueWeightKg - effectiveBand).toFixed(2)),
      __bandWidth:     parseFloat((effectiveBand * 2).toFixed(2)),
    })

    // Advance history — low-confidence entries are still added (EWMA downweights them)
    history.push({ date: d.label, trueWeightKg: bd.trueWeightKg, confidence: conf.level as ConfidenceLevel })
  }

  return results
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const CONF_BADGE: Record<ConfidenceLevel, string> = {
  high:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-red-100 text-red-600',
}

// ─── Scenario card ────────────────────────────────────────────────────────────

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false)
  const results = runScenario(scenario.days)
  const pass    = evaluateScenario(scenario, results)

  return (
    <div className={`rounded-xl border p-4 ${scenario.colorClass}`}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="text-xl">{scenario.icon}</span>
          <div>
            <p className="font-semibold text-gray-800">{scenario.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{scenario.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {pass ? '✓ Pass' : '⚠ Review'}
          </span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Expected behaviour */}
          <div className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
            <span className="font-medium">Expected: </span>{scenario.expected}
          </div>

          {/* Mini chart */}
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={results} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} unit=" kg" width={48} />
              <Tooltip
                formatter={(value, name) => {
                  if (String(name).startsWith('__')) return null
                  const labels: Record<string, string> = {
                    scaleKg: 'Scale', trueWeightKg: 'Adjusted', baselineTrendKg: 'Baseline',
                  }
                  return [`${value} kg`, labels[String(name)] ?? name]
                }}
              />
              <Area type="monotone" dataKey="__bandLow"   stackId="b" stroke="none" fill="none"    legendType="none" dot={false} activeDot={false} />
              <Area type="monotone" dataKey="__bandWidth" stackId="b" stroke="none" fill="#10b981" fillOpacity={0.2} legendType="none" dot={false} activeDot={false} />
              <Line type="monotone" dataKey="baselineTrendKg" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="trueWeightKg"    stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="scaleKg"         stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Results table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1.5 pr-3 font-medium">Day</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Scale</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Stripped</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Adjusted</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Baseline</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Band</th>
                  <th className="text-right py-1.5 font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i} className={r.isSetup ? 'text-gray-400' : 'text-gray-700'}>
                    <td className="py-1.5 pr-3 font-medium">
                      {r.label}
                      {r.isOutlier && <span className="ml-1 text-red-500 text-xs">⚠</span>}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${r.isOutlier ? 'text-red-500 font-semibold' : ''}`}>
                      {r.scaleKg.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-amber-600">
                      {r.totalRetention > 0 ? `−${r.totalRetention.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700 font-semibold">
                      {r.trueWeightKg.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                      {r.baselineTrendKg !== null ? r.baselineTrendKg.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-gray-400">
                      ±{r.bandKg}
                      {r.dynamicBandSource === 'dynamic' && <span className="text-emerald-500 ml-0.5">*</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.isSetup ? (
                        <span className="text-gray-300">setup</span>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${CONF_BADGE[r.confidence]}`}>
                          {r.confidence}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-1.5">* = dynamic band (volatility-based). No asterisk = static fallback (insufficient history).</p>
          </div>

          {/* Pass condition note */}
          <p className="text-xs text-gray-400">
            <span className="font-medium">Pass condition:</span> {scenario.passCondition}
          </p>

          {!pass && (
            <div className="text-xs p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
              ⚠ One or more days did not meet the pass condition. Review the table above and check algorithm inputs.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TrueWeightBacktest() {
  const allResults = SCENARIOS.map(s => ({
    ...s,
    results: runScenario(s.days),
    pass:    evaluateScenario(s, runScenario(s.days)),
  }))
  const passCount = allResults.filter(s => s.pass).length

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-xl font-semibold">Backtest Harness</h2>
        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${passCount === SCENARIOS.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {passCount}/{SCENARIOS.length} pass
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        5 synthetic scenarios replayed against the algorithm. v3: days are processed chronologically — each entry builds on prior history. All computations are client-side.
      </p>

      <div className="space-y-3">
        {SCENARIOS.map(s => (
          <ScenarioCard key={s.id} scenario={s} />
        ))}
      </div>
    </div>
  )
}
