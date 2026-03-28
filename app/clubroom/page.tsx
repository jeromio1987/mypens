'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Flame, Dumbbell, Moon, UtensilsCrossed, Scale,
  Trophy, TrendingDown, Layers, Star, Lock,
  TrendingUp, Minus, Bed, Zap,
} from 'lucide-react'
import type { Medal, WeeklyWrap, ReportCard } from '@/app/api/clubroom/route'

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Flame, Dumbbell, Moon, UtensilsCrossed, Scale, Trophy, TrendingDown, Layers, Star,
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  bronze:   { ring: 'ring-amber-700',   bg: 'bg-amber-900/40',   icon: 'text-amber-600',  label: 'text-amber-500'  },
  silver:   { ring: 'ring-slate-400',   bg: 'bg-slate-700/40',   icon: 'text-slate-300',  label: 'text-slate-300'  },
  gold:     { ring: 'ring-yellow-500',  bg: 'bg-yellow-900/40',  icon: 'text-yellow-400', label: 'text-yellow-400' },
  platinum: { ring: 'ring-cyan-300',    bg: 'bg-cyan-900/30',    icon: 'text-cyan-200',   label: 'text-cyan-200'   },
}

const CATEGORY_LABEL: Record<string, string> = {
  streak: 'Streak', milestone: 'Milestone', progress: 'Progress', special: 'Special',
}

// ── Medal badge ───────────────────────────────────────────────────────────────

function MedalBadge({ medal }: { medal: Medal }) {
  const t = TIER_CONFIG[medal.tier]
  const Icon = ICON_MAP[medal.icon] ?? Trophy

  if (!medal.earned) {
    return (
      <div className="flex flex-col items-center gap-2 min-w-[80px]">
        <div className="w-14 h-14 rounded-full bg-pens-surface/40 ring-1 ring-pens-muted flex items-center justify-center">
          <Lock size={18} className="text-pens-muted" />
        </div>
        <p className="text-[10px] text-pens-muted text-center leading-tight max-w-[72px]">{medal.label}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 min-w-[80px]">
      <div className={`w-14 h-14 rounded-full ${t.bg} ring-2 ${t.ring} flex items-center justify-center shadow-lg`}>
        <Icon size={22} className={t.icon} />
      </div>
      <div className="text-center">
        <p className={`text-[10px] font-semibold ${t.label} leading-tight`}>{medal.label}</p>
        <p className="text-[9px] text-pens-muted mt-0.5 uppercase tracking-wide">{CATEGORY_LABEL[medal.category]}</p>
      </div>
    </div>
  )
}

// ── Weekly wrap card ──────────────────────────────────────────────────────────

function WeeklyWrapCard({ wrap }: { wrap: WeeklyWrap }) {
  const delta = wrap.weightTrend.delta
  const TrendIcon = delta == null ? Minus : delta < -0.05 ? TrendingDown : delta > 0.05 ? TrendingUp : Minus
  const trendColor = delta == null ? 'text-pens-muted' : delta < -0.05 ? 'text-emerald-400' : delta > 0.05 ? 'text-red-400' : 'text-pens-muted'

  return (
    <div className="bg-pens-surface rounded-2xl p-5 space-y-4 border border-pens-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">Weekly Wrap</p>
          <p className="text-sm text-pens-cream font-semibold mt-0.5">{wrap.weekLabel}</p>
        </div>
        <Zap size={16} className="text-pens-gold" />
      </div>

      <p className="text-xs text-pens-cream/80 leading-relaxed border-l-2 border-pens-crimson pl-3 italic">
        "{wrap.headline}"
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* Weight */}
        {wrap.weightTrend.to !== null && (
          <div className="bg-pens-navy rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-1">Adjusted Weight</p>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-pens-cream">{wrap.weightTrend.to}</span>
              <span className="text-xs text-pens-muted">kg</span>
              <TrendIcon size={13} className={`${trendColor} ml-1`} />
            </div>
            {delta !== null && (
              <p className={`text-xs font-medium mt-0.5 ${trendColor}`}>
                {delta > 0 ? '+' : ''}{delta} kg this week
              </p>
            )}
          </div>
        )}

        {/* Training */}
        <div className="bg-pens-navy rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-1">Training</p>
          <span className="text-lg font-bold text-pens-cream">{wrap.trainingSessions}</span>
          <span className="text-xs text-pens-muted ml-1">sessions</span>
          {wrap.trainingVolume > 0 && (
            <p className="text-xs text-pens-muted mt-0.5">{wrap.trainingVolume.toLocaleString()} kg vol</p>
          )}
        </div>

        {/* Sleep */}
        {wrap.sleepAvgHours !== null && (
          <div className="bg-pens-navy rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-1">Sleep</p>
            <span className="text-lg font-bold text-pens-cream">{wrap.sleepAvgHours}h</span>
            <span className="text-xs text-pens-muted ml-1">avg</span>
            {wrap.sleepAvgQuality !== null && (
              <p className="text-xs text-pens-muted mt-0.5">Quality {wrap.sleepAvgQuality}/5</p>
            )}
          </div>
        )}

        {/* Food */}
        {wrap.avgKcal !== null && (
          <div className="bg-pens-navy rounded-xl p-3">
            <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-1">Nutrition</p>
            <span className="text-lg font-bold text-pens-cream">{wrap.avgKcal}</span>
            <span className="text-xs text-pens-muted ml-1">kcal/day</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Report to Self ─────────────────────────────────────────────────────────────

function ReportToSelf({ report }: { report: ReportCard }) {
  const sections = [
    { label: 'What happened', text: report.whatHappened, accent: 'border-pens-crimson' },
    { label: 'What it means', text: report.whatItMeans, accent: 'border-pens-gold' },
    { label: 'What next',     text: report.whatNext,    accent: 'border-emerald-600' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bed size={14} className="text-pens-muted" />
        <p className="text-[10px] uppercase tracking-widest text-pens-muted font-semibold">Report to Self</p>
      </div>
      {sections.map(({ label, text, accent }) => (
        <div key={label} className={`bg-pens-surface rounded-2xl p-4 border-l-4 ${accent}`}>
          <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-2 font-semibold">{label}</p>
          <p className="text-sm text-pens-cream/90 leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface ClubroomData {
  medals: Medal[]
  weeklyWrap: WeeklyWrap
  report: ReportCard
}

export default function ClubroomPage() {
  const [data, setData]       = useState<ClubroomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<'all' | Medal['category']>('all')

  useEffect(() => {
    fetch('/api/clubroom')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Could not load the Clubroom.'))
      .finally(() => setLoading(false))
  }, [])

  const categories: { key: 'all' | Medal['category']; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'streak',    label: 'Streaks' },
    { key: 'milestone', label: 'Milestones' },
    { key: 'progress',  label: 'Progress' },
    { key: 'special',   label: 'Special' },
  ]

  const medals = data?.medals ?? []
  const earned  = medals.filter(m => m.earned)
  const filtered = activeCategory === 'all' ? medals : medals.filter(m => m.category === activeCategory)
  const filteredEarned = filtered.filter(m => m.earned)
  const filteredLocked = filtered.filter(m => !m.earned)

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-muted hover:text-pens-cream transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">Private · V1</p>
              <h1 className="text-2xl font-bold text-pens-cream leading-tight">The Clubroom</h1>
            </div>
          </div>
          {!loading && data && (
            <div className="text-right">
              <p className="text-2xl font-bold text-pens-gold">{earned.length}</p>
              <p className="text-[9px] uppercase tracking-widest text-pens-muted">medals earned</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-16 text-pens-muted text-sm">Loading your Clubroom…</div>
        )}

        {error && (
          <div className="bg-pens-crimson/20 border border-pens-crimson/40 rounded-2xl p-4 text-sm text-pens-cream">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === key
                      ? 'bg-pens-crimson text-pens-cream'
                      : 'bg-pens-surface text-pens-muted hover:text-pens-cream'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Earned medals */}
            {filteredEarned.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-pens-gold mb-3 font-semibold px-1">
                  Earned · {filteredEarned.length}
                </p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                  {filteredEarned.map(medal => (
                    <MedalBadge key={medal.id} medal={medal} />
                  ))}
                </div>
              </div>
            )}

            {/* Locked medals */}
            {filteredLocked.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-pens-muted mb-3 font-semibold px-1">
                  Locked · {filteredLocked.length}
                </p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                  {filteredLocked.map(medal => (
                    <div key={medal.id} className="flex flex-col items-center gap-2 min-w-[80px] group relative">
                      <MedalBadge medal={medal} />
                      {/* tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-pens-surface border border-pens-muted/40 rounded-xl px-3 py-2 text-[10px] text-pens-cream w-36 text-center shadow-xl z-10 leading-snug">
                        {medal.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredEarned.length === 0 && filteredLocked.length === 0 && (
              <p className="text-sm text-pens-muted text-center py-4">No medals in this category yet.</p>
            )}

            {/* Divider */}
            <div className="border-t border-pens-muted/20" />

            {/* Weekly wrap */}
            <WeeklyWrapCard wrap={data.weeklyWrap} />

            {/* Divider */}
            <div className="border-t border-pens-muted/20" />

            {/* Report to self */}
            <ReportToSelf report={data.report} />

            {/* Footer note */}
            <p className="text-[10px] text-pens-muted text-center pb-4">
              The Clubroom is private · Your data never leaves this device
            </p>
          </>
        )}
      </div>
    </main>
  )
}
