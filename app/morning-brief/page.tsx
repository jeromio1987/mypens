'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Moon, Scale, BookOpen, Anchor, TrendingUp, TrendingDown, Minus, AlertTriangle, Lock } from 'lucide-react'

const ANCHOR_PIN = '4033'

interface MorningBriefData {
  date: string
  narrative?: string
  priorities?: { rank: number; label: string; hint: string; module: string }[]
  sleep: {
    date: string
    hours: number
    quality: number
    hrv: number | null
    bedtime: string
    wakeTime: string
    qualityLabel: string
    verdict: string
  } | null
  weight: {
    date: string
    scaleKg: number
    trueWeightKg: number
    bodyFatPct: number | null
    avgTrueWeight7d: number | null
    deltaKg: number | null
  } | null
  mode: {
    value: string | null
    tags: string[]
    verdict: string
  }
  journal: {
    date: string
    title: string | null
    mood: number | null
    preview: string
  } | null
  anchor: {
    streak: number
  }
  investing: {
    regime: string | null
    effectiveDate: string | null
    watchlist: string[]
    upcoming: { date: string; title: string; kind: string; source: string }[]
  }
}

const MOOD_LABEL: Record<number, string> = {
  1: 'Very low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Strong',
}

const MOOD_COLOR: Record<number, string> = {
  1: 'text-pens-crimson', 2: 'text-amber-400', 3: 'text-pens-cream/60',
  4: 'text-emerald-400',  5: 'text-emerald-400',
}

const MODE_STYLE: Record<string, { label: string; dot: string; border: string; text: string }> = {
  locked_in: { label: 'Locked In',  dot: 'bg-pens-crimson',   border: 'border-pens-crimson/40',   text: 'text-pens-crimson' },
  balanced:  { label: 'Balanced',   dot: 'bg-pens-gold',      border: 'border-pens-gold/40',      text: 'text-pens-gold'    },
  off:       { label: 'Off',        dot: 'bg-pens-cream/30',  border: 'border-pens-muted/30',     text: 'text-pens-cream/40'},
}

function SleepCard({ data }: { data: MorningBriefData['sleep'] }) {
  if (!data) {
    return (
      <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Moon size={14} className="text-violet-400" />
          <p className="text-[10px] uppercase tracking-widest text-violet-400 font-semibold">Sleep</p>
        </div>
        <p className="text-sm text-pens-cream/40">No sleep logged yet.</p>
      </div>
    )
  }

  const hrsWhole = Math.floor(data.hours)
  const hrsMins = Math.round((data.hours - hrsWhole) * 60)
  const hoursDisplay = hrsMins > 0 ? `${hrsWhole}h ${hrsMins}m` : `${hrsWhole}h`
  const qualityTone = data.quality >= 4 ? 'text-emerald-400' : data.quality >= 3 ? 'text-pens-gold' : 'text-pens-crimson'

  return (
    <div className="bg-pens-navy/60 border border-violet-800/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-violet-400" />
          <p className="text-[10px] uppercase tracking-widest text-violet-400 font-semibold">Sleep</p>
        </div>
        <span className="text-xs text-pens-cream/30">{data.bedtime} → {data.wakeTime}</span>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <span className="text-5xl font-black tabular-nums text-pens-cream leading-none">{hoursDisplay}</span>
        <div className="pb-1 space-y-0.5">
          <p className={`text-sm font-bold ${qualityTone}`}>{data.qualityLabel}</p>
          {data.hrv && (
            <p className="text-xs text-pens-cream/50">HRV {data.hrv} ms</p>
          )}
        </div>
      </div>

      <p className="text-xs text-pens-cream/50 border-t border-pens-muted/20 pt-3">{data.verdict}</p>
    </div>
  )
}

function WeightCard({ data }: { data: MorningBriefData['weight'] }) {
  if (!data) {
    return (
      <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={14} className="text-emerald-400" />
          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Weight</p>
        </div>
        <p className="text-sm text-pens-cream/40">No weight logged yet.</p>
      </div>
    )
  }

  const delta = data.deltaKg
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaTone = delta == null ? 'text-pens-cream/30' : delta > 0.5 ? 'text-amber-400' : delta < -0.5 ? 'text-emerald-400' : 'text-pens-cream/40'
  const deltaLabel = delta == null ? '' : delta > 0 ? `+${delta}` : `${delta}`

  return (
    <div className="bg-pens-navy/60 border border-emerald-800/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-emerald-400" />
          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Weight</p>
        </div>
        <span className="text-xs text-pens-cream/30">{data.date}</span>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <span className="text-5xl font-black tabular-nums text-pens-cream leading-none">
          {data.trueWeightKg.toFixed(1)}
          <span className="text-xl font-bold text-pens-cream/40 ml-1">kg</span>
        </span>
        {delta != null && (
          <div className={`pb-1 flex items-center gap-1 ${deltaTone}`}>
            <DeltaIcon size={13} />
            <span className="text-sm font-bold tabular-nums">{deltaLabel} kg</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-pens-muted/20 pt-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 font-semibold">Scale</p>
          <p className="text-xs font-bold text-pens-cream/60 tabular-nums">{data.scaleKg.toFixed(1)} kg</p>
        </div>
        {data.avgTrueWeight7d && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 font-semibold">7d avg</p>
            <p className="text-xs font-bold text-pens-cream/60 tabular-nums">{data.avgTrueWeight7d.toFixed(1)} kg</p>
          </div>
        )}
        {data.bodyFatPct && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 font-semibold">Body fat</p>
            <p className="text-xs font-bold text-pens-cream/60 tabular-nums">{data.bodyFatPct.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({
  mode, anchor, anchorUnlocked, onAnchorUnlock,
}: {
  mode: MorningBriefData['mode']
  anchor: MorningBriefData['anchor']
  anchorUnlocked: boolean
  onAnchorUnlock: () => void
}) {
  const style = mode.value ? MODE_STYLE[mode.value] : null
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function openPin() {
    setPinOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className={`bg-pens-navy/60 border rounded-2xl p-5 ${style ? style.border : 'border-pens-muted/20'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {style && <span className={`w-2 h-2 rounded-full ${style.dot}`} />}
          <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">Today&apos;s Mode</p>
        </div>

        {anchor.streak > 0 && (
          anchorUnlocked ? (
            <div className="flex items-center gap-1.5">
              <Anchor size={11} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-400 tabular-nums">{anchor.streak}d</span>
            </div>
          ) : (
            <div className="relative">
              <button onClick={openPin} className="flex items-center gap-1.5 group">
                <Anchor size={11} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-500 tabular-nums">••d</span>
                <Lock size={9} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </button>
              {pinOpen && (
                <div className={`absolute right-0 top-7 z-20 bg-pens-deep border border-pens-muted/30 rounded-xl p-3 shadow-2xl ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
                  <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 font-semibold mb-2 whitespace-nowrap">Enter PIN</p>
                  <input
                    ref={inputRef}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '')
                      if (v === ANCHOR_PIN) {
                        onAnchorUnlock()
                        setPinOpen(false)
                        setPin('')
                      } else if (v.length === 4) {
                        setPin('')
                        setShake(true)
                        setTimeout(() => setShake(false), 500)
                      } else {
                        setPin(v)
                      }
                    }}
                    onBlur={() => { setPinOpen(false); setPin('') }}
                    className="w-20 bg-pens-navy/60 border border-pens-muted/30 rounded-lg px-2 py-1.5 text-sm font-mono text-center text-pens-cream tracking-[0.3em] outline-none focus:border-slate-500"
                  />
                </div>
              )}
            </div>
          )
        )}
      </div>

      {mode.value && style ? (
        <>
          <p className={`text-3xl font-black tracking-tight ${style.text} mb-2`}>{style.label}</p>
          {mode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {mode.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded-full bg-pens-surface/60 border border-pens-muted/20 text-pens-cream/50">
                  {t.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xl font-bold text-pens-cream/30 mb-2">Not set</p>
      )}

      <p className="text-xs text-pens-cream/40 border-t border-pens-muted/20 pt-3">{mode.verdict}</p>
    </div>
  )
}

function JournalCard({ data }: { data: MorningBriefData['journal'] }) {
  if (!data) {
    return (
      <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} className="text-pink-400" />
          <p className="text-[10px] uppercase tracking-widest text-pink-400 font-semibold">Journal</p>
        </div>
        <p className="text-sm text-pens-cream/40">No journal entries yet.</p>
      </div>
    )
  }

  const moodColor = data.mood ? MOOD_COLOR[data.mood] ?? 'text-pens-cream/60' : 'text-pens-cream/30'
  const moodLabel = data.mood ? MOOD_LABEL[data.mood] : null

  return (
    <div className="bg-pens-navy/60 border border-pink-900/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-pink-400" />
          <p className="text-[10px] uppercase tracking-widest text-pink-400 font-semibold">Journal</p>
        </div>
        <div className="flex items-center gap-2">
          {moodLabel && (
            <span className={`text-xs font-bold ${moodColor}`}>{moodLabel}</span>
          )}
          <span className="text-xs text-pens-cream/30">{data.date}</span>
        </div>
      </div>

      {data.title && (
        <p className="text-sm font-bold text-pens-cream mb-2">{data.title}</p>
      )}
      <p className="text-xs text-pens-cream/50 leading-relaxed">{data.preview}</p>
    </div>
  )
}

function InvestingCard({ data }: { data: MorningBriefData['investing'] }) {
  const hasRegime = data.regime != null
  const hasUpcoming = data.upcoming.length > 0

  return (
    <div className="bg-pens-navy/60 border border-amber-900/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-amber-400" />
          <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Investing · Regime</p>
        </div>
        <Link href="/investing" className="text-[9px] uppercase tracking-wider text-amber-400/80 hover:text-amber-300 font-bold">
          Hub →
        </Link>
      </div>

      {hasRegime ? (
        <p className="text-lg font-black text-pens-cream mb-1 capitalize">{data.regime?.replace(/_/g, ' ')}</p>
      ) : (
        <p className="text-sm font-bold text-pens-cream/50 mb-1">No regime logged</p>
      )}
      {data.effectiveDate && (
        <p className="text-[10px] text-pens-cream/40 mb-3">Since {data.effectiveDate}</p>
      )}

      {data.watchlist.length > 0 && (
        <p className="text-[10px] text-pens-cream/40 mb-2">
          Watchlist:{' '}
          <span className="font-mono text-pens-cream/60">{data.watchlist.join(', ')}</span>
        </p>
      )}

      {hasUpcoming ? (
        <ul className="border-t border-pens-muted/20 pt-3 space-y-2">
          {data.upcoming.map((e, i) => (
            <li key={`${e.date}-${i}`} className="text-xs text-pens-cream/60 flex justify-between gap-2">
              <span className="text-pens-cream/40 shrink-0">{e.date}</span>
              <span className="text-right">{e.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pens-cream/40 border-t border-pens-muted/20 pt-3">No macro events in the next 14 days (add manual or watchlist).</p>
      )}
    </div>
  )
}

export default function MorningBriefPage() {
  const [data, setData] = useState<MorningBriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [anchorUnlocked, setAnchorUnlocked] = useState(false)

  useEffect(() => {
    fetch('/api/morning-brief')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const dateLabel = data?.date
    ? new Date(data.date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Morning Brief</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); setError(false); fetch('/api/morning-brief').then(r => r.json()).then(d => setData(d)).catch(() => setError(true)).finally(() => setLoading(false)) }}
            className="text-xs text-pens-cream/30 hover:text-pens-cream/60 transition-colors px-2 py-1"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-pens-navy/40 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-pens-navy/60 border border-pens-crimson/30 rounded-2xl p-5 flex items-center gap-3">
            <AlertTriangle size={16} className="text-pens-crimson shrink-0" />
            <p className="text-sm text-pens-cream/60">Could not load brief. Server may be offline.</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {data.narrative && (
              <div className="bg-pens-navy/70 border border-pens-gold/25 rounded-2xl p-5">
                <p className="text-[10px] uppercase tracking-widest text-pens-gold font-semibold mb-2">Today in one pass</p>
                <p className="text-sm text-pens-cream/85 leading-relaxed">{data.narrative}</p>
              </div>
            )}
            {data.priorities && data.priorities.length > 0 && (
              <div className="bg-pens-navy/60 border border-pens-muted/25 rounded-2xl p-5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/50 font-semibold">Priorities</p>
                <ol className="space-y-2 list-decimal list-inside text-sm text-pens-cream/75">
                  {data.priorities.map((p, i) => (
                    <li key={i} className="leading-snug">
                      <span className="font-semibold text-pens-cream">{p.label}</span>
                      <span className="text-pens-cream/55"> — {p.hint}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <SleepCard data={data.sleep} />
            <WeightCard data={data.weight} />
            <ModeCard mode={data.mode} anchor={data.anchor} anchorUnlocked={anchorUnlocked} onAnchorUnlock={() => setAnchorUnlocked(true)} />
            <JournalCard data={data.journal} />
            <InvestingCard data={data.investing} />
          </>
        )}

        {/* Module links */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-2 pt-4">
            {([
              { href: '/sleep',   label: 'Sleep',   color: 'text-violet-400' },
              { href: '/weight',  label: 'Weight',  color: 'text-emerald-400' },
              { href: '/journal', label: 'Journal', color: 'text-pink-400' },
            ] as const).map(m => (
              <Link
                key={m.href}
                href={m.href}
                className="bg-pens-navy/40 border border-pens-muted/20 rounded-xl p-3 text-center hover:border-pens-muted/40 transition-colors"
              >
                <p className={`text-[9px] uppercase tracking-widest font-semibold ${m.color}`}>{m.label}</p>
                <p className="text-[9px] text-pens-cream/30 mt-0.5">Log →</p>
              </Link>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
