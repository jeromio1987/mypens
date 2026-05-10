'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, TrendingDown, TrendingUp, Minus, Download, Scale,
  Moon, Dumbbell, Ruler, DatabaseBackup, BookOpen,
  Plane, Thermometer, Palmtree, Salad, Trophy, Tag,
  CheckCircle, AlertTriangle, Info, CalendarDays, Flame, Map, Target, Sparkles, Image as ImageIcon,
  FileText,
} from 'lucide-react'
import type { StructuredInsight } from '@/app/api/dashboard/route'
import GoalsPanel from '@/components/goals/GoalsPanel'
import SyncStatusBadge from '@/components/shared/SyncStatusBadge'
import NotificationsBadge from '@/components/shared/NotificationsBadge'
import WeightExplanationCard from '@/components/weight/WeightExplanationCard'
import PremiumGate from '@/components/shared/PremiumGate'
import { useTier, setTierInStore } from '@/hooks/useTier'

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
  high:   'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30',
  medium: 'bg-amber-900/30 text-pens-gold border border-amber-500/30',
  low:    'bg-pens-crimson/10 text-red-400 border border-pens-crimson/30',
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
  travel:       { bg: 'bg-blue-900/20',    text: 'text-blue-300',    border: 'border-blue-500/30' },
  illness:      { bg: 'bg-red-900/20',     text: 'text-red-300',     border: 'border-red-500/30' },
  holiday:      { bg: 'bg-emerald-900/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'diet-break': { bg: 'bg-amber-900/20',   text: 'text-pens-gold',   border: 'border-amber-500/30' },
  competition:  { bg: 'bg-violet-900/20',  text: 'text-violet-300',  border: 'border-violet-500/30' },
  other:        { bg: 'bg-pens-navy/40',   text: 'text-pens-cream/70', border: 'border-pens-muted/30' },
}

const INSIGHT_SEVERITY_STYLES: Record<string, { icon: React.ElementType; border: string; iconColor: string; bg: string }> = {
  positive: { icon: CheckCircle,  border: 'border-emerald-500/30', iconColor: 'text-emerald-400', bg: 'bg-emerald-900/20' },
  warning:  { icon: AlertTriangle,border: 'border-amber-500/30',   iconColor: 'text-pens-gold',   bg: 'bg-amber-900/20' },
  info:     { icon: Info,         border: 'border-blue-500/30',    iconColor: 'text-blue-400',    bg: 'bg-blue-900/20' },
}

function TrendArrow({ v }: { v: number | null }) {
  if (v == null) return null
  if (v < -0.05) return <TrendingDown size={14} className="text-emerald-400" />
  if (v > 0.05)  return <TrendingUp   size={14} className="text-red-400" />
  return <Minus size={14} className="text-pens-cream/40" />
}

function QualityDots({ q }: { q: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= q ? 'bg-violet-500' : 'bg-pens-muted/40'}`} />
      ))}
    </span>
  )
}

const MODULES = [
  { href: '/weight',       label: 'Weight',       icon: Scale,        color: 'text-blue-400' },
  { href: '/sleep',        label: 'Sleep',        icon: Moon,         color: 'text-violet-400' },
  { href: '/training',     label: 'Training',     icon: Dumbbell,     color: 'text-orange-400' },
  { href: '/measurements', label: 'Measurements', icon: Ruler,        color: 'text-rose-400' },
  { href: '/journal',      label: 'Journal',      icon: BookOpen,     color: 'text-emerald-400' },
  { href: '/events',       label: 'Events',       icon: CalendarDays, color: 'text-sky-400' },
]

const STREAK_MODULES = [
  { key: 'weight'      , label: 'Weight',       icon: Scale,   color: 'text-blue-400' },
  { key: 'sleep'       , label: 'Sleep',        icon: Moon,    color: 'text-violet-400' },
  { key: 'training'    , label: 'Training',     icon: Dumbbell,color: 'text-orange-400' },
  { key: 'measurements', label: 'Measurements', icon: Ruler,   color: 'text-rose-400' },
]

export default function DashboardClient() {
  const { tier, isPremium, isLoading: tierLoading } = useTier()
  const [tierBusy, setTierBusy]   = useState(false)
  const [data, setData]         = useState<DashboardData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [streaks, setStreaks]   = useState<StreaksData | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showGoals, setShowGoals] = useState(false)

  async function downloadWeeklyReport() {
    try {
      const res = await fetch('/api/report/weekly')
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-pens-weekly.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  async function handlePremiumDevToggle() {
    const next = tier === 'premium' ? 'free' : 'premium'
    setTierBusy(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: next }),
      })
      if (res.ok) {
        const j = (await res.json()) as { tier?: string }
        setTierInStore(j.tier === 'premium' ? 'premium' : 'free')
      }
    } finally {
      setTierBusy(false)
    }
  }

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
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        {showGoals && <GoalsPanel onClose={() => setShowGoals(false)} />}
        <SyncStatusBadge />
        <NotificationsBadge />

        <div className="rounded-xl border border-pens-muted/25 bg-pens-navy/40 px-3 py-3 space-y-2 text-sm">
          <label className="flex items-center gap-2 text-pens-cream/85 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded accent-pens-gold"
              checked={isPremium}
              disabled={tierLoading || tierBusy}
              onChange={() => { void handlePremiumDevToggle() }}
            />
            Premium mode: ON/OFF
          </label>
          <PremiumGate feature="Weekly PDF report" className="rounded-lg w-full">
            <button
              type="button"
              onClick={() => void downloadWeeklyReport()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-pens-muted/40 bg-pens-deep/40 text-pens-cream text-xs w-full justify-center hover:border-pens-gold/40 hover:bg-pens-navy transition-colors"
            >
              <FileText size={14} className="shrink-0 text-pens-gold" />
              Download weekly report (PDF)
            </button>
          </PremiumGate>
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
            <h1 className="text-2xl font-bold text-pens-cream">Weekly Overview</h1>
          </div>
          <Link
            href="/clubroom"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pens-navy hover:bg-pens-deep rounded-xl text-xs font-medium text-pens-gold transition-colors border border-pens-gold/20"
          >
            <Sparkles size={13} />
            Clubroom
          </Link>
          <Link
            href="/data"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pens-navy/60 hover:bg-pens-navy rounded-xl text-xs font-medium text-pens-cream/60 transition-colors border border-pens-muted/30"
          >
            <Download size={13} />
            Data
          </Link>
          <Link
            href="/roadmap"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pens-navy/60 hover:bg-pens-navy rounded-xl text-xs font-medium text-pens-cream/60 transition-colors border border-pens-muted/30"
          >
            <Map size={13} />
            Roadmap
          </Link>
          <Link
            href="/mockups"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pens-navy/60 hover:bg-pens-navy rounded-xl text-xs font-medium text-pens-cream/60 transition-colors border border-pens-muted/30"
          >
            <ImageIcon size={13} />
            Mockups
          </Link>
          <button
            onClick={() => setShowGoals(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-pens-cream/70 bg-pens-navy/60 hover:bg-pens-navy px-3 py-1.5 rounded-xl transition-colors border border-pens-muted/30"
          >
            <Target size={14} />
            Goals
          </button>
        </div>

        {loading && <div className="text-center py-12 text-pens-cream/40 text-sm">Loading…</div>}

        {apiError && (
          <div className="bg-pens-crimson/10 border border-pens-crimson/30 rounded-2xl p-5 text-sm text-red-400">
            <p className="font-semibold mb-1">Dashboard failed to load</p>
            <p>{apiError}</p>
            <p className="mt-3 text-red-400/70 font-mono text-xs">npx prisma db push</p>
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
            <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-blue-400" />
                  <h2 className="font-semibold text-pens-cream">Weight</h2>
                </div>
                <Link href="/weight" className="text-xs text-pens-cream/40 hover:text-pens-cream/70 transition-colors">Log →</Link>
              </div>
              {data.weight.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-3xl font-bold text-pens-cream">{data.weight.latest.trueWeightKg}</span>
                    <span className="text-pens-cream/40 text-sm">kg adjusted</span>
                    <TrendArrow v={data.weight.trend7} />
                    {data.weight.latest.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[data.weight.latest.confidence]}`}>
                        {data.weight.latest.confidence} confidence
                      </span>
                    )}
                  </div>
                  {data.weight.latest.confidence && (
                    <p className="text-xs text-pens-cream/40 flex items-center gap-1">
                      <Info size={11} className="shrink-0" />
                      {CONFIDENCE_DESCRIPTIONS[data.weight.latest.confidence]}
                      {data.weight.latest.activeConfounders > 0 && ` · ${data.weight.latest.activeConfounders} active factor${data.weight.latest.activeConfounders > 1 ? 's' : ''}`}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm text-pens-cream/50">
                    <span>Scale: {data.weight.latest.scaleKg} kg</span>
                    {data.weight.avg7 && <span>7-day avg: {data.weight.avg7} kg</span>}
                  </div>
                  {data.weight.trend7 != null && (
                    <p className={`text-xs font-medium ${data.weight.trend7 <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.weight.trend7 > 0 ? '+' : ''}{data.weight.trend7} kg vs 7 days ago
                    </p>
                  )}
                  <p className="text-xs text-pens-cream/40">Last logged: {data.weight.latest.date}</p>
                </div>
              ) : (
                <p className="text-sm text-pens-cream/40">No data this week</p>
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


            {/* Sleep card */}
            <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Moon size={16} className="text-violet-400" />
                  <h2 className="font-semibold text-pens-cream">Sleep — Last night</h2>
                </div>
                <Link href="/sleep" className="text-xs text-pens-cream/40 hover:text-pens-cream/70 transition-colors">Log →</Link>
              </div>
              {data.sleep.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-pens-cream">{data.sleep.latest.hours}h</span>
                    <QualityDots q={data.sleep.latest.quality} />
                  </div>
                  <p className="text-sm text-pens-cream/50">{data.sleep.latest.bedtime} → {data.sleep.latest.wakeTime}</p>
                  <div className="flex gap-4 text-xs text-pens-cream/40">
                    {data.sleep.avgHours7 != null && <span>7-day avg: {data.sleep.avgHours7}h</span>}
                    {data.sleep.avgQuality7 != null && <span>Avg quality: {data.sleep.avgQuality7}/5</span>}
                    {data.sleep.avgHrv7 != null && <span>Avg HRV: {data.sleep.avgHrv7} ms</span>}
                  </div>
                  <p className="text-xs text-pens-cream/40">{data.sleep.daysLogged}/7 nights logged</p>
                </div>
              ) : (
                <p className="text-sm text-pens-cream/40">No data this week</p>
              )}
            </div>

            {/* Training card */}
            <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-orange-400" />
                  <h2 className="font-semibold text-pens-cream">Training — This week</h2>
                </div>
                <Link href="/training" className="text-xs text-pens-cream/40 hover:text-pens-cream/70 transition-colors">Log →</Link>
              </div>
              <div className="flex gap-6 mb-3">
                <div>
                  <p className="text-3xl font-bold text-pens-cream">{data.training.weekSessions}</p>
                  <p className="text-xs text-pens-cream/40">sessions</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-pens-cream">{data.training.weekVolume.toLocaleString()}</p>
                  <p className="text-xs text-pens-cream/40">kg volume</p>
                </div>
              </div>
              {data.training.topExercises.length > 0 && (
                <div className="space-y-1">
                  {data.training.topExercises.map(({ exercise, volume }) => (
                    <div key={exercise} className="flex justify-between text-xs text-pens-cream/60">
                      <span>{exercise}</span>
                      <span className="text-pens-cream/40">{volume.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              )}
              {!data.training.weekSessions && <p className="text-sm text-pens-cream/40">No sessions this week</p>}
            </div>

            {/* Measurements card */}
            <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-rose-400" />
                  <h2 className="font-semibold text-pens-cream">Measurements</h2>
                </div>
                <Link href="/measurements" className="text-xs text-pens-cream/40 hover:text-pens-cream/70 transition-colors">Log →</Link>
              </div>
              {data.measurements.latest ? (
                <div className="space-y-2">
                  <p className="text-xs text-pens-cream/40">{data.measurements.latest.date}</p>
                  <div className="flex gap-4 text-sm">
                    {data.measurements.latest.waistCm != null && (
                      <div>
                        <span className="font-bold text-pens-cream">{data.measurements.latest.waistCm}</span>
                        <span className="text-pens-cream/40 text-xs"> cm waist</span>
                        {data.measurements.delta?.waistCm != null && (
                          <span className={`ml-1 text-xs font-medium ${data.measurements.delta.waistCm <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ({data.measurements.delta.waistCm > 0 ? '+' : ''}{data.measurements.delta.waistCm})
                          </span>
                        )}
                      </div>
                    )}
                    {data.measurements.latest.chestCm != null && (
                      <div>
                        <span className="font-bold text-pens-cream">{data.measurements.latest.chestCm}</span>
                        <span className="text-pens-cream/40 text-xs"> cm chest</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-pens-cream/40">No measurements logged yet</p>
              )}
            </div>

            {/* Structured Insights */}
            {data.insights && data.insights.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-pens-cream/60 text-sm px-1">Weekly insights</h2>
                {data.insights.map(insight => {
                  const cfg = INSIGHT_SEVERITY_STYLES[insight.severity] ?? INSIGHT_SEVERITY_STYLES.info
                  const Icon = cfg.icon
                  return (
                    <div key={insight.id} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <Icon size={16} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-pens-cream mb-1">{insight.title}</p>
                          <p className="text-sm text-pens-cream/70 leading-relaxed">{insight.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-pens-cream/40 px-1">Rule-based · Based on last 7 days of logged data</p>
              </div>
            )}

            {/* Streaks */}
            {streaks && (
              <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-pens-cream flex items-center gap-2">
                    <Flame size={16} className="text-orange-400" />
                    Logging Streaks
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STREAK_MODULES.map(({ key, label, icon: Icon, color }) => {
                    const s = streaks[key as keyof StreaksData]
                    return (
                      <div key={key} className="bg-pens-navy/40 rounded-xl p-3 text-center">
                        <Icon size={15} className={`${color} mx-auto mb-1`} />
                        <p className="text-xs text-pens-cream/50 mb-1">{label}</p>
                        {s.current > 0 ? (
                          <p className="text-lg font-bold text-orange-400 leading-none">
                            {s.current}<span className="text-xs font-normal text-pens-cream/40">d</span>
                          </p>
                        ) : (
                          <p className="text-sm text-pens-cream/20 font-medium">—</p>
                        )}
                        <p className="text-[10px] text-pens-cream/40 mt-0.5">{s.coverage}% / 30d</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick-log bar */}
            <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-4">
              <p className="text-xs font-medium text-pens-cream/50 mb-3">Quick log</p>
              <div className="flex gap-2 flex-wrap">
                {MODULES.map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-2 bg-pens-navy/40 hover:bg-pens-navy rounded-xl text-sm font-medium text-pens-cream/70 hover:text-pens-cream transition-colors"
                  >
                    <Icon size={14} className={color} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Verdict shortcut */}
            <Link
              href="/verdict"
              className="flex items-center justify-between bg-pens-crimson/10 border border-pens-crimson/20 rounded-2xl px-5 py-4 hover:bg-pens-crimson/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles size={16} className="text-pens-crimson" />
                <div>
                  <p className="text-sm font-semibold text-pens-cream">Member Dashboard</p>
                  <p className="text-xs text-pens-cream/40">P.E.N.S. scores · Ledger · Verdict</p>
                </div>
              </div>
              <span className="text-xs text-pens-cream/40">→</span>
            </Link>

            {/* Data management shortcut */}
            <Link
              href="/data"
              className="flex items-center justify-between bg-pens-surface/80 border border-pens-muted/20 rounded-2xl px-5 py-4 hover:bg-pens-navy/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DatabaseBackup size={16} className="text-pens-cream/40" />
                <div>
                  <p className="text-sm font-semibold text-pens-cream">Data Management</p>
                  <p className="text-xs text-pens-cream/40">Export · Import · Backup</p>
                </div>
              </div>
              <span className="text-xs text-pens-cream/40">→</span>
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
