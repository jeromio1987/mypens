'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, TrendingDown, TrendingUp, Minus, Download, Scale,
  UtensilsCrossed, Moon, Dumbbell, Ruler, DatabaseBackup,
  Plane, Thermometer, Palmtree, Salad, Trophy, Tag,
  CheckCircle, AlertTriangle, Info, CalendarDays, Flame, Activity, Map, Target,
} from 'lucide-react'
import type { StructuredInsight } from '@/app/api/dashboard/route'
import GoalsPanel from '@/components/goals/GoalsPanel'
import WeightExplanationCard from '@/components/weight/WeightExplanationCard'

interface StreakModule { current: number; longest: number; lastLogged: string | null; coverage: number }
interface StreaksData {
  weight: StreakModule; food: StreakModule; sleep: StreakModule
  training: StreakModule; measurements: StreakModule
}

interface EventTag { id: string; type: string; label: string; startDate: string; endDate: string; notes?: string | null }

interface WeightBreakdown {
  creatineKg: number; alcoholKg: number; glycogenKg: number
  sodiumKg: number; hardTrainingKg: number; totalAdjustmentKg: number
  tanitaFlags: string[]
}

interface DashboardData {
  weight: {
    latest: {
      scaleKg: number; trueWeightKg: number; date: string
      confidence: 'high' | 'medium' | 'low' | null
      activeConfounders: number
      breakdown: WeightBreakdown | null
    } | null
    avg7: number | null
    trend7: number | null
  }
  food: {
    today: { kcal: number; proteinG: number; carbsG: number; fatG: number; entries: number }
    avgKcal7: number | null
  }
  sleep: {
    latest: { hours: number; quality: number; bedtime: string; wakeTime: string; date: string } | null
    avgHours7: number | null
    avgQuality7: number | null
    avgHrv7: number | null
    daysLogged: number
  }
  training: {
    weekSessions: number
    weekVolume: number
    topExercises: { exercise: string; volume: number }[]
    lastDate: string | null
  }
  measurements: {
    latest: { waistCm: number | null; chestCm: number | null; hipsCm: number | null; date: string } | null
    delta: { waistCm: number | null; chestCm: number | null } | null
  }
  events: {
    active: EventTag[]
    recent: EventTag[]
  }
  insights: StructuredInsight[]
}

type ConfidenceLevel = 'high' | 'medium' | 'low'

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low:    'bg-red-50 text-red-600 border border-red-200',
}

const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  high:   'No confounders — reading is reliable',
  medium: '1–2 factors affecting reading',
  low:    'Multiple factors — rough estimate',
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  travel: Plane, illness: Thermometer, holiday: Palmtree,
  'diet-break': Salad, competition: Trophy, other: Tag,
}

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  travel:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  illness:      { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  holiday:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'diet-break': { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  competition:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  other:        { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200' },
}

const INSIGHT_SEVERITY_STYLES: Record<string, { icon: React.ElementType; border: string; iconColor: string; bg: string }> = {
  positive: { icon: CheckCircle,  border: 'border-emerald-200', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
  warning:  { icon: AlertTriangle,border: 'border-amber-200',   iconColor: 'text-amber-500',   bg: 'bg-amber-50' },
  info:     { icon: Info,         border: 'border-blue-200',    iconColor: 'text-blue-400',    bg: 'bg-blue-50' },
}

function TrendArrow({ v }: { v: number | null }) {
  if (v == null) return null
  if (v < -0.05) return <TrendingDown size={14} className="text-green-500" />
  if (v > 0.05)  return <TrendingUp   size={14} className="text-red-500" />
  return <Minus size={14} className="text-gray-400" />
}

function QualityDots({ q }: { q: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= q ? 'bg-violet-500' : 'bg-gray-200'}`} />
      ))}
    </span>
  )
}

const MODULES = [
  { href: '/weight',       label: 'Weight',       icon: Scale,          color: 'text-blue-600' },
  { href: '/food',         label: 'Food',         icon: UtensilsCrossed,color: 'text-emerald-600' },
  { href: '/sleep',        label: 'Sleep',        icon: Moon,           color: 'text-violet-600' },
  { href: '/training',     label: 'Training',     icon: Dumbbell,       color: 'text-orange-500' },
  { href: '/measurements', label: 'Measurements', icon: Ruler,          color: 'text-rose-600' },
  { href: '/events',       label: 'Events',       icon: CalendarDays,   color: 'text-sky-600' },
]

const STREAK_MODULES = [
  { key: 'weight'      , label: 'Weight',       icon: Scale,          color: 'text-blue-600' },
  { key: 'food'        , label: 'Food',         icon: UtensilsCrossed,color: 'text-emerald-600' },
  { key: 'sleep'       , label: 'Sleep',        icon: Moon,           color: 'text-violet-600' },
  { key: 'training'    , label: 'Training',     icon: Dumbbell,       color: 'text-orange-500' },
  { key: 'measurements', label: 'Measurements', icon: Ruler,          color: 'text-rose-600' },
]

export default function DashboardClient() {
  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [streaks, setStreaks]   = useState<StreaksData | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showGoals, setShowGoals] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.weight) {
          setApiError(d.error ?? 'Unexpected response. Make sure you have run: npx prisma db push')
        } else {
          setData(d)
        }
      })
      .catch(() => setApiError('Could not reach the dashboard API.'))
      .finally(() => setLoading(false))
    fetch('/api/streaks').then(r => r.json()).then(setStreaks).catch(() => null)
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        {showGoals && <GoalsPanel onClose={() => setShowGoals(false)} />}
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Weekly Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">Last 7 days at a glance</p>
          </div>
          <Link
            href="/data"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium text-gray-600 transition-colors"
          >
            <Download size={13} className="text-gray-500" />
            Data
          </Link>
          <Link
            href="/roadmap"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium text-gray-600 transition-colors"
          >
            <Map size={13} className="text-gray-500" />
            Roadmap
          </Link>
          <button
            onClick={() => setShowGoals(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Target size={14} />
            Goals
          </button>
        </div>

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}

        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Dashboard failed to load</p>
            <p>{apiError}</p>
            <p className="mt-3 text-red-500 font-mono text-xs">npx prisma db push</p>
          </div>
        )}

        {data && (
          <>
            {/* Active event banners */}
            {data.events.active.length > 0 && (
              <div className="space-y-2">
                {data.events.active.map(event => {
                  const cfg = EVENT_COLORS[event.type] ?? EVENT_COLORS.other
                  const Icon = EVENT_ICONS[event.type] ?? Tag
                  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  return (
                    <div key={event.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                      <Icon size={15} className={`${cfg.text} shrink-0`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${cfg.text}`}>{event.label}</p>
                        <p className={`text-xs opacity-60 ${cfg.text}`}>
                          {fmt(event.startDate)}{event.startDate !== event.endDate ? ` – ${fmt(event.endDate)}` : ''}
                        </p>
                      </div>
                      <Link href="/events" className={`text-xs underline opacity-60 ${cfg.text}`}>Manage</Link>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Weight card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-blue-600" />
                  <h2 className="font-semibold text-gray-800">Weight</h2>
                </div>
                <Link href="/weight" className="text-xs text-blue-500 hover:underline">Log →</Link>
              </div>
              {data.weight.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-3xl font-bold text-gray-900">{data.weight.latest.trueWeightKg}</span>
                    <span className="text-gray-400 text-sm">kg adjusted</span>
                    <TrendArrow v={data.weight.trend7} />
                    {data.weight.latest.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[data.weight.latest.confidence]}`}>
                        {data.weight.latest.confidence} confidence
                      </span>
                    )}
                  </div>
                  {data.weight.latest.confidence && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Info size={11} className="shrink-0" />
                      {CONFIDENCE_DESCRIPTIONS[data.weight.latest.confidence]}
                      {data.weight.latest.activeConfounders > 0 && ` · ${data.weight.latest.activeConfounders} active factor${data.weight.latest.activeConfounders > 1 ? 's' : ''}`}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Scale: {data.weight.latest.scaleKg} kg</span>
                    {data.weight.avg7 && <span>7-day avg: {data.weight.avg7} kg</span>}
                  </div>
                  {data.weight.trend7 != null && (
                    <p className={`text-xs font-medium ${data.weight.trend7 <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {data.weight.trend7 > 0 ? '+' : ''}{data.weight.trend7} kg vs 7 days ago
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Last logged: {data.weight.latest.date}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data this week</p>
              )}
            </div>

            {/* Weight explanation card */}
            {data.weight.latest?.confidence && data.weight.latest.breakdown && (
              <WeightExplanationCard
                scaleKg={data.weight.latest.scaleKg}
                trueWeightKg={data.weight.latest.trueWeightKg}
                confidence={data.weight.latest.confidence}
                activeConfounders={data.weight.latest.activeConfounders}
                breakdown={data.weight.latest.breakdown}
              />
            )}

            {/* Food card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={16} className="text-emerald-600" />
                  <h2 className="font-semibold text-gray-800">Food — Today</h2>
                </div>
                <Link href="/food" className="text-xs text-emerald-500 hover:underline">Log →</Link>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">{Math.round(data.food.today.kcal)}</span>
                <span className="text-gray-400 text-sm mb-1">kcal · {data.food.today.entries} items</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Protein', val: data.food.today.proteinG, color: 'text-blue-600' },
                  { label: 'Carbs',   val: data.food.today.carbsG,   color: 'text-amber-600' },
                  { label: 'Fat',     val: data.food.today.fatG,     color: 'text-orange-500' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl py-2">
                    <p className={`text-sm font-bold ${color}`}>{Math.round(val)}g</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              {data.food.avgKcal7 != null && (
                <p className="text-xs text-gray-400 mt-2">7-day avg: {Math.round(data.food.avgKcal7)} kcal/day</p>
              )}
            </div>

            {/* Sleep card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Moon size={16} className="text-violet-600" />
                  <h2 className="font-semibold text-gray-800">Sleep — Last night</h2>
                </div>
                <Link href="/sleep" className="text-xs text-violet-500 hover:underline">Log →</Link>
              </div>
              {data.sleep.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-gray-900">{data.sleep.latest.hours}h</span>
                    <QualityDots q={data.sleep.latest.quality} />
                  </div>
                  <p className="text-sm text-gray-500">{data.sleep.latest.bedtime} → {data.sleep.latest.wakeTime}</p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    {data.sleep.avgHours7 != null && <span>7-day avg: {data.sleep.avgHours7}h</span>}
                    {data.sleep.avgQuality7 != null && <span>Avg quality: {data.sleep.avgQuality7}/5</span>}
                    {data.sleep.avgHrv7 != null && <span>Avg HRV: {data.sleep.avgHrv7} ms</span>}
                  </div>
                  <p className="text-xs text-gray-400">{data.sleep.daysLogged}/7 nights logged</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data this week</p>
              )}
            </div>

            {/* Training card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-orange-500" />
                  <h2 className="font-semibold text-gray-800">Training — This week</h2>
                </div>
                <Link href="/training" className="text-xs text-orange-500 hover:underline">Log →</Link>
              </div>
              <div className="flex gap-6 mb-3">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{data.training.weekSessions}</p>
                  <p className="text-xs text-gray-400">sessions</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{data.training.weekVolume.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">kg volume</p>
                </div>
              </div>
              {data.training.topExercises.length > 0 && (
                <div className="space-y-1">
                  {data.training.topExercises.map(({ exercise, volume }) => (
                    <div key={exercise} className="flex justify-between text-xs text-gray-600">
                      <span>{exercise}</span>
                      <span className="text-gray-400">{volume.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              )}
              {!data.training.weekSessions && <p className="text-sm text-gray-400">No sessions this week</p>}
            </div>

            {/* Measurements card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-rose-600" />
                  <h2 className="font-semibold text-gray-800">Measurements</h2>
                </div>
                <Link href="/measurements" className="text-xs text-rose-500 hover:underline">Log →</Link>
              </div>
              {data.measurements.latest ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">{data.measurements.latest.date}</p>
                  <div className="flex gap-4 text-sm">
                    {data.measurements.latest.waistCm != null && (
                      <div>
                        <span className="font-bold text-gray-900">{data.measurements.latest.waistCm}</span>
                        <span className="text-gray-400 text-xs"> cm waist</span>
                        {data.measurements.delta?.waistCm != null && (
                          <span className={`ml-1 text-xs font-medium ${data.measurements.delta.waistCm <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ({data.measurements.delta.waistCm > 0 ? '+' : ''}{data.measurements.delta.waistCm})
                          </span>
                        )}
                      </div>
                    )}
                    {data.measurements.latest.chestCm != null && (
                      <div>
                        <span className="font-bold text-gray-900">{data.measurements.latest.chestCm}</span>
                        <span className="text-gray-400 text-xs"> cm chest</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No measurements logged yet</p>
              )}
            </div>

            {/* Structured Insights */}
            {data.insights && data.insights.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-700 text-sm px-1">Weekly insights</h2>
                {data.insights.map(insight => {
                  const cfg = INSIGHT_SEVERITY_STYLES[insight.severity] ?? INSIGHT_SEVERITY_STYLES.info
                  const Icon = cfg.icon
                  return (
                    <div key={insight.id} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <Icon size={16} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 mb-1">{insight.title}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{insight.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 px-1">Rule-based · Based on last 7 days of logged data</p>
              </div>
            )}

            {/* Streaks */}
            {streaks && (
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Flame size={16} className="text-orange-500" />
                    Logging Streaks
                  </h2>
                  <Link href="/data-health" className="flex items-center gap-1 text-xs text-teal-500 hover:underline">
                    <Activity size={12} />
                    Data health →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {STREAK_MODULES.map(({ key, label, icon: Icon, color }) => {
                    const s = streaks[key as keyof StreaksData]
                    return (
                      <div key={key} className="bg-gray-50 rounded-xl p-3 text-center">
                        <Icon size={15} className={`${color} mx-auto mb-1`} />
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        {s.current > 0 ? (
                          <p className="text-lg font-bold text-orange-500 leading-none">
                            {s.current}<span className="text-xs font-normal text-gray-400">d</span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-300 font-medium">—</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.coverage}% / 30d</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick-log bar */}
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">Quick log</p>
              <div className="flex gap-2 flex-wrap">
                {MODULES.map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                  >
                    <Icon size={14} className={color} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Data management shortcut */}
            <Link
              href="/data"
              className="flex items-center justify-between bg-white rounded-2xl shadow px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DatabaseBackup size={16} className="text-gray-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Data Management</p>
                  <p className="text-xs text-gray-400">Export · Import · Backup</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">→</span>
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
