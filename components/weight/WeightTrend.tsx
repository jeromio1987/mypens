'use client'

import { useEffect, useState } from 'react'
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
import { ChevronRight, ChevronDown, Pencil, Check, X } from 'lucide-react'
import type { ConfidenceLevel } from '@/lib/retentionModels'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  id: string
  date: string
  scaleKg: number
  trueWeightKg: number       // v3 from GET (sodium + hardTraining included)
  bodyFatPct?: number
  // stored breakdown components
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  // v3 — on-the-fly (returned by GET, not stored in DB)
  sodiumKg: number
  hardTrainingKg: number
  // context flags
  hardTraining: boolean
  morningReading: boolean
  highSodium: boolean
  restaurantMeal: boolean
  flightDay: boolean
  illnessDay: boolean
  tanitaReliable: boolean
  // raw inputs — for explanation layer
  creatineDoseG: number
  creatineDaysOn: number
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  // v3 trend context — returned by GET
  confidence: ConfidenceLevel
  baselineTrendKg: number | null
  dynamicBandKg: number
  dynamicBandSource: 'dynamic' | 'static'
  isOutlier: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONF_STYLES: Record<ConfidenceLevel, string> = {
  high:   'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-red-50 text-red-600',
}

// ─── Explanation panel ────────────────────────────────────────────────────────

interface Factor { label: string; kg: number; detail: string; color: string }
interface Flag   { label: string; detail: string; type?: 'warn' | 'info' }

function buildExplanation(e: Entry): { factors: Factor[]; flags: Flag[] } {
  const factors: Factor[] = []
  const flags:   Flag[]   = []

  if (e.creatineRetentionKg > 0) {
    const isLoading = (e.creatineDoseG ?? 0) >= 10
    const days      = e.creatineDaysOn ?? 0
    const phase     = isLoading
      ? `loading phase (day ${days} of 7)`
      : days >= 25 ? 'saturated maintenance' : `maintenance (day ${days})`
    factors.push({
      label:  'Creatine retention',
      kg:     e.creatineRetentionKg,
      detail: `${e.creatineDoseG}g/day, ${phase} — intramuscular water binding`,
      color:  'text-blue-600',
    })
  }

  if (e.alcoholRetentionKg > 0) {
    factors.push({
      label:  'Alcohol retention',
      kg:     e.alcoholRetentionKg,
      detail: `${e.alcoholUnits} units, ${e.hoursSinceAlcohol}h ago — peaks then reverses via diuresis`,
      color:  'text-purple-600',
    })
  }

  if (e.glycogenRetentionKg > 0) {
    const excess = Math.max(0, (e.carbsG ?? 0) - 150)
    factors.push({
      label:  'Glycogen / high-carb',
      kg:     e.glycogenRetentionKg,
      detail: `${e.carbsG}g carbs (excess ${excess}g) — each gram glycogen binds ~3.5g water`,
      color:  'text-orange-600',
    })
  }

  // v3 — sodium now quantified (moved from flags)
  if (e.sodiumKg > 0) {
    factors.push({
      label:  'Sodium retention',
      kg:     e.sodiumKg,
      detail: e.highSodium
        ? 'High sodium day — osmotic water binding (~0.3 kg estimated)'
        : 'Restaurant meal — hidden sodium proxy (~0.15 kg estimated)',
      color:  'text-cyan-600',
    })
  }

  // v3 — hard training now quantified (moved from flags)
  if (e.hardTrainingKg > 0) {
    factors.push({
      label:  'Training inflammation',
      kg:     e.hardTrainingKg,
      detail: 'DOMS / micro-damage → transient inflammatory water retention (~0.3 kg)',
      color:  'text-rose-600',
    })
  }

  // Remaining pure flags (not quantifiable)
  if (e.flightDay)       flags.push({ label: 'Flight / sedentary day',  detail: 'Fluid pools in lower extremities', type: 'warn' })
  if (e.illnessDay)      flags.push({ label: 'Illness / inflammation',  detail: 'Scale and BIA both unreliable — entry is informational only', type: 'warn' })
  if (!e.morningReading) flags.push({ label: 'Non-morning reading',     detail: 'Evening readings run 0.5–1.5 kg heavier than fasted morning', type: 'warn' })

  // v3 — trend context flags
  if (e.isOutlier) {
    flags.push({
      label:  'Statistical outlier',
      detail: `Scale weight is unusually far from your recent trend (baseline: ${e.baselineTrendKg} kg). Check for missed confounders or a measurement error.`,
      type:   'warn',
    })
  } else if (e.baselineTrendKg !== null) {
    const deviation = parseFloat((e.trueWeightKg - e.baselineTrendKg).toFixed(2))
    if (deviation > 0.4) {
      flags.push({
        label:  `+${deviation} kg above 7-day baseline (${e.baselineTrendKg} kg)`,
        detail: 'Adjusted weight is trending above your recent baseline — retained water or genuine gain in progress.',
        type:   'info',
      })
    } else if (deviation < -0.4) {
      flags.push({
        label:  `${deviation} kg below 7-day baseline (${e.baselineTrendKg} kg)`,
        detail: 'Adjusted weight is below recent baseline — depletion, deficit, or water loss.',
        type:   'info',
      })
    }
  }

  return { factors, flags }
}

function ExplanationPanel({ entry }: { entry: Entry }) {
  const { factors, flags } = buildExplanation(entry)
  const conf               = entry.confidence
  const bandKg             = entry.dynamicBandKg
  const bandSource         = entry.dynamicBandSource
  const lo = parseFloat((entry.trueWeightKg - bandKg).toFixed(2))
  const hi = parseFloat((entry.trueWeightKg + bandKg).toFixed(2))

  const totalRetention = parseFloat(
    (entry.creatineRetentionKg + entry.alcoholRetentionKg + entry.glycogenRetentionKg + entry.sodiumKg + entry.hardTrainingKg).toFixed(2),
  )

  const bandBg =
    conf === 'high'   ? 'bg-emerald-50 border-emerald-100' :
    conf === 'medium' ? 'bg-amber-50 border-amber-100'     :
                        'bg-red-50 border-red-100'

  return (
    <div className="mx-1 mb-2 px-3 py-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-3">

      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-700">Why adjusted ≠ scale weight</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${CONF_STYLES[conf]}`}>
          {conf} confidence
        </span>
      </div>

      {factors.length > 0 ? (
        <div className="space-y-1.5">
          {factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`font-medium ${f.color} shrink-0 w-36`}>{f.label}</span>
              <span className="text-gray-400 flex-1">{f.detail}</span>
              <span className={`font-semibold ${f.color} shrink-0`}>−{f.kg} kg</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-1.5 flex justify-between font-medium text-gray-600">
            <span>Total retention stripped</span>
            <span className="text-gray-800">−{totalRetention} kg</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-400">No quantified retention — scale weight ≈ adjusted weight.</p>
      )}

      {flags.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-gray-500">Context flags:</p>
          {flags.map((f, i) => {
            const isInfo = f.type === 'info'
            return (
              <div key={i} className={`flex gap-1.5 ${isInfo ? 'text-blue-600' : 'text-amber-700'}`}>
                <span className="shrink-0">{isInfo ? 'ℹ' : '⚠'}</span>
                <span>
                  <span className="font-medium">{f.label}</span>
                  <span className={`${isInfo ? 'text-blue-500' : 'text-amber-600'}`}> — {f.detail}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className={`rounded-lg p-2.5 border ${bandBg}`}>
        <p className="font-medium text-gray-800">
          Adjusted:{' '}
          <span className="text-gray-900">{entry.trueWeightKg} kg</span>
          <span className="text-gray-500"> ± {bandKg} kg</span>
          <span className="text-gray-400 font-normal"> ({lo}–{hi} kg plausible range)</span>
        </p>
        {bandSource === 'dynamic' && (
          <p className="text-gray-400 mt-0.5 text-xs">Band from your actual recent volatility — more personalised than the default rule.</p>
        )}
        {entry.baselineTrendKg !== null && (
          <p className="text-gray-500 mt-1">
            7-day baseline: <span className="font-medium text-gray-700">{entry.baselineTrendKg} kg</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  scaleKg:         'Scale',
  trueWeightKg:    'Adjusted',
  baselineTrendKg: 'Baseline',
  retention:       'Retention',
}

interface TooltipEntry { dataKey?: string | number; color?: string; value?: number }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  const visible = payload.filter(p => p.dataKey && !String(p.dataKey).startsWith('__'))
  if (!visible.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-gray-600 mb-1">{label}</p>
      {visible.map((p, i) => (
        p.value != null && (
          <p key={i} style={{ color: p.color ?? '#374151' }}>
            {KEY_LABELS[p.dataKey as string] ?? p.dataKey}: {p.value} kg
          </p>
        )
      ))}
    </div>
  )
}

// ─── Custom outlier dot ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScaleDot(props: any) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return null
  if (payload?.isOutlier) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" fillOpacity={0.15} />
        <circle cx={cx} cy={cy} r={3.5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill="#6366f1" />
}

// ─── Main component ───────────────────────────────────────────────────────────

type ChartEntry = Entry & {
  label: string
  retention: number
  __bandLow: number
  __bandWidth: number
}

interface WeightEditForm {
  scaleKg: string
  carbsG: string
  alcoholUnits: string
  hardTraining: boolean
  morningReading: boolean
  highSodium: boolean
  restaurantMeal: boolean
  flightDay: boolean
  illnessDay: boolean
}

export default function WeightTrend({ refresh }: { refresh?: number }) {
  const [data, setData]             = useState<ChartEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<WeightEditForm | null>(null)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/weight')
      .then(r => r.json())
      .then((entries: Entry[]) => {
        // GET now returns ascending order — no re-sort needed
        const sorted = entries.map(e => ({
          ...e,
          label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short',
          }),
          retention:    parseFloat((e.scaleKg - e.trueWeightKg).toFixed(2)),
          __bandLow:    parseFloat((e.trueWeightKg - e.dynamicBandKg).toFixed(2)),
          __bandWidth:  parseFloat((e.dynamicBandKg * 2).toFixed(2)),
        }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }, [refresh])

  const loadData = () => {
    setLoading(true)
    fetch('/api/weight')
      .then(r => r.json())
      .then((entries: Entry[]) => {
        const sorted = entries.map(e => ({
          ...e,
          label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short',
          }),
          retention:    parseFloat((e.scaleKg - e.trueWeightKg).toFixed(2)),
          __bandLow:    parseFloat((e.trueWeightKg - e.dynamicBandKg).toFixed(2)),
          __bandWidth:  parseFloat((e.dynamicBandKg * 2).toFixed(2)),
        }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }

  const startEdit = (e: ChartEntry) => {
    setEditingId(e.id)
    setExpandedId(null)
    setEditForm({
      scaleKg:       String(e.scaleKg),
      carbsG:        String(e.carbsG ?? 0),
      alcoholUnits:  String(e.alcoholUnits ?? 0),
      hardTraining:  e.hardTraining,
      morningReading: e.morningReading,
      highSodium:    e.highSodium,
      restaurantMeal: e.restaurantMeal,
      flightDay:     e.flightDay,
      illnessDay:    e.illnessDay,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null) }

  const saveEdit = async (id: string) => {
    if (!editForm) return
    setSaving(true)
    try {
      const res = await fetch('/api/weight', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          scaleKg:       parseFloat(editForm.scaleKg),
          carbsG:        parseFloat(editForm.carbsG)       || 0,
          alcoholUnits:  parseFloat(editForm.alcoholUnits) || 0,
          hardTraining:  editForm.hardTraining,
          morningReading: editForm.morningReading,
          highSodium:    editForm.highSodium,
          restaurantMeal: editForm.restaurantMeal,
          flightDay:     editForm.flightDay,
          illnessDay:    editForm.illnessDay,
        }),
      })
      if (res.ok) { loadData(); cancelEdit() }
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading chart…</div>

  if (data.length === 0)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        No entries yet — log your first weight above.
      </div>
    )

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full">
      <h2 className="text-xl font-semibold mb-0.5">30-Day Trend</h2>
      <p className="text-xs text-gray-400 mb-4">
        Green band = uncertainty interval · Dashed = 7-day baseline trend · Red dots = statistical outliers
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit=" kg" width={52} />
          <Tooltip content={<ChartTooltip />} />

          {/* Confidence band — stacked area trick */}
          <Area type="monotone" dataKey="__bandLow"   stackId="band" stroke="none" fill="none"    legendType="none" dot={false} activeDot={false} />
          <Area type="monotone" dataKey="__bandWidth" stackId="band" stroke="none" fill="#10b981" fillOpacity={0.18} legendType="none" dot={false} activeDot={false} />

          {/* 7-day rolling baseline — gaps where null (< 3 prior entries) */}
          <Line
            type="monotone"
            dataKey="baselineTrendKg"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
          />

          {/* Adjusted weight */}
          <Line type="monotone" dataKey="trueWeightKg" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />

          {/* Scale weight — custom dot highlights outliers in red */}
          <Line type="monotone" dataKey="scaleKg" stroke="#6366f1" strokeWidth={2} dot={<ScaleDot />} />

          {/* Retention delta */}
          <Line type="monotone" dataKey="retention" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Manual legend */}
      <div className="flex flex-wrap gap-4 mt-2 mb-5 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-indigo-500 rounded" />Scale
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-emerald-500 rounded" />Adjusted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-slate-400 rounded" style={{ borderTop: '2px dashed #94a3b8' }} />Baseline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-amber-400 rounded" style={{ borderTop: '2px dashed #f59e0b' }} />Retention
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2.5 rounded bg-emerald-200 opacity-70" />Uncertainty band
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-400 opacity-80" />Outlier
        </span>
      </div>

      {/* Tappable history */}
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-2">
          History — tap any entry for breakdown
        </h3>
        <div className="space-y-px max-h-96 overflow-y-auto">
          {[...data].reverse().map(e => {
            const bandKg     = e.dynamicBandKg
            const isExpanded = expandedId === e.id
            const isEditing  = editingId  === e.id

            return (
              <div key={e.id}>
                {isEditing && editForm ? (
                  <div className="bg-blue-50 rounded-xl p-3 space-y-2 my-0.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 mb-0.5 block">Scale reading (kg)</label>
                        <input
                          type="number" step="0.01"
                          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          value={editForm.scaleKg}
                          onChange={ev => setEditForm(f => f ? { ...f, scaleKg: ev.target.value } : f)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Carbs today (g)</label>
                        <input type="number" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" value={editForm.carbsG}       onChange={ev => setEditForm(f => f ? { ...f, carbsG:       ev.target.value } : f)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Alcohol units</label>
                        <input type="number" step="0.5" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" value={editForm.alcoholUnits} onChange={ev => setEditForm(f => f ? { ...f, alcoholUnits: ev.target.value } : f)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {([
                        ['hardTraining',  'Hard training yesterday'],
                        ['morningReading','Morning reading (fasted)'],
                        ['highSodium',    'High-sodium meal'],
                        ['restaurantMeal','Restaurant / eating out'],
                        ['flightDay',     'Flight day'],
                        ['illnessDay',    'Illness'],
                      ] as [keyof WeightEditForm, string][]).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded accent-blue-500"
                            checked={editForm[key] as boolean}
                            onChange={ev => setEditForm(f => f ? { ...f, [key]: ev.target.checked } : f)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><X size={12} /> Cancel</button>
                      <button onClick={() => saveEdit(e.id)} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"><Check size={12} /> Save &amp; recalculate</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center group">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : e.id)}
                        className="flex-1 flex items-center gap-2 text-sm py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-gray-400 w-14 shrink-0 text-xs">{e.label}</span>
                        <span className={`font-medium w-16 shrink-0 ${e.isOutlier ? 'text-red-500' : ''}`}>
                          {e.scaleKg} kg{e.isOutlier && ' ⚠'}
                        </span>
                        <span className="text-emerald-600 font-medium flex-1">
                          → {e.trueWeightKg}
                          <span className="text-emerald-400 font-normal text-xs"> ±{bandKg}</span>
                          {e.baselineTrendKg !== null && (
                            <span className="text-slate-400 font-normal text-xs ml-1">(base {e.baselineTrendKg})</span>
                          )}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${CONF_STYLES[e.confidence]}`}>
                          {e.confidence}
                        </span>
                        <span className="text-amber-500 text-xs w-10 text-right shrink-0">
                          {e.retention > 0 ? `+${e.retention}` : '—'}
                        </span>
                        {isExpanded
                          ? <ChevronDown  size={13} className="text-gray-300 shrink-0" />
                          : <ChevronRight size={13} className="text-gray-300 shrink-0" />
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 ml-0.5 text-gray-300 hover:text-blue-400 shrink-0"
                        title="Edit entry"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                    {isExpanded && <ExplanationPanel entry={e} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
