'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Target } from 'lucide-react'
import type { DayPlan, GoalKind, LongDay, Sport } from '@/lib/planner/planWeek'

const ALL_SPORTS: Sport[] = ['running', 'cycling', 'core', 'gym']
const GOALS: { kind: GoalKind; label: string; hint: string }[] = [
  { kind: 'vo2max', label: 'VO₂max target', hint: 'e.g. reach 50' },
  { kind: 'bodyfat', label: '~13% BF hold muscle', hint: 'gym-biased week' },
  { kind: 'marathon', label: 'Marathon build', hint: 'weekend long run' },
  { kind: 'custom', label: 'Custom', hint: 'your own wording' },
]

type PlanResponse = {
  weekOf: string
  goal: {
    id?: string
    kind: string
    label: string
    targetNum?: number | null
    longDay: string
    sportsJson?: string
  } | null
  plan: {
    weekOf: string
    goal: { kind: string; label: string; longDay: string; sports: Sport[] }
    days: DayPlan[]
    notes: string[]
  }
  saved: { accepted: boolean } | null
}

export default function PlannerPage() {
  const [data, setData] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<GoalKind>('marathon')
  const [label, setLabel] = useState('Run a marathon')
  const [targetNum, setTargetNum] = useState<string>('')
  const [longDay, setLongDay] = useState<LongDay>('saturday')
  const [sports, setSports] = useState<Sport[]>(['running', 'core', 'gym'])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/planner')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
      if (json.goal) {
        setKind(json.goal.kind)
        setLabel(json.goal.label)
        setTargetNum(json.goal.targetNum != null ? String(json.goal.targetNum) : '')
        setLongDay(json.goal.longDay === 'sunday' ? 'sunday' : 'saturday')
        try {
          const s = JSON.parse(json.goal.sportsJson || '[]')
          if (Array.isArray(s) && s.length) setSports(s)
        } catch {
          /* keep */
        }
      } else if (json.plan?.goal) {
        setKind(json.plan.goal.kind)
        setLabel(json.plan.goal.label)
        setLongDay(json.plan.goal.longDay)
        setSports(json.plan.goal.sports)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSport = (s: Sport) => {
    setSports(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]))
  }

  const saveGoal = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_goal',
          kind,
          label:
            kind === 'vo2max' && targetNum
              ? `VO₂max → ${targetNum}`
              : kind === 'bodyfat'
                ? label || '~13% body fat without losing muscle'
                : label,
          targetNum: targetNum ? Number(targetNum) : null,
          longDay,
          sports: sports.length ? sports : ['running'],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const acceptWeek = async () => {
    if (!data?.plan) return
    setSaving(true)
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_week',
          weekOf: data.weekOf,
          goalId: data.goal?.id,
          plan: data.plan,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Accept failed')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Accept failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-pens-cream/40 hover:text-pens-cream/70">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-orange-400/90 font-semibold">
              Phase 6
            </p>
            <h1 className="text-2xl font-bold text-pens-cream">Adaptive Sports Planner</h1>
            <p className="text-xs text-pens-cream/45 mt-0.5">
              Sleep + load aware · long session Sat or Sun only
            </p>
          </div>
          <Link
            href="/period-review"
            className="ml-auto text-xs px-3 py-1.5 rounded-full border border-cyan-500/40 text-cyan-300"
          >
            Engine cockpit →
          </Link>
        </div>

        {/* Goal */}
        <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5 space-y-4">
          <div className="flex items-center gap-2 text-pens-cream">
            <Target size={16} className="text-orange-400" />
            <h2 className="font-semibold">Your goal</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button
                key={g.kind}
                type="button"
                onClick={() => {
                  setKind(g.kind)
                  if (g.kind === 'vo2max') setLabel('VO₂max target')
                  if (g.kind === 'bodyfat') setLabel('~13% body fat without losing muscle')
                  if (g.kind === 'marathon') setLabel('Run a marathon')
                  if (g.kind === 'custom') setLabel('Custom goal')
                }}
                className={`text-left rounded-xl border px-3 py-2 ${
                  kind === g.kind
                    ? 'border-orange-500/50 bg-orange-500/10 text-pens-cream'
                    : 'border-pens-muted/25 text-pens-cream/60'
                }`}
              >
                <p className="text-sm font-medium">{g.label}</p>
                <p className="text-[11px] text-pens-cream/40">{g.hint}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-pens-cream/50 flex-1 min-w-[180px]">
              Label
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="mt-1 w-full rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-2 py-1.5 text-sm text-pens-cream"
              />
            </label>
            {kind === 'vo2max' && (
              <label className="text-xs text-pens-cream/50">
                Target
                <input
                  value={targetNum}
                  onChange={e => setTargetNum(e.target.value)}
                  placeholder="50"
                  className="mt-1 w-24 block rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-2 py-1.5 text-sm text-pens-cream"
                />
              </label>
            )}
          </div>
          <div>
            <p className="text-xs text-pens-cream/50 mb-2">Long session day</p>
            <div className="flex gap-2">
              {(['saturday', 'sunday'] as LongDay[]).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setLongDay(d)}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
                    longDay === d
                      ? 'border-orange-400 text-orange-200 bg-orange-500/15'
                      : 'border-pens-muted/30 text-pens-cream/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-pens-cream/50 mb-2">Sports you can switch between</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SPORTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSport(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
                    sports.includes(s)
                      ? 'border-orange-400 text-orange-200 bg-orange-500/15'
                      : 'border-pens-muted/30 text-pens-cream/40'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveGoal()}
            className="text-sm px-4 py-2 rounded-xl bg-orange-600/80 hover:bg-orange-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save goal & rebuild week'}
          </button>
        </section>

        {loading && <p className="text-pens-cream/50 text-sm">Building week…</p>}
        {error && <p className="text-red-300 text-sm">{error}</p>}

        {data?.plan && (
          <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-orange-400" />
              <h2 className="font-semibold text-pens-cream">
                Week of {data.weekOf}
                {data.saved?.accepted ? (
                  <span className="ml-2 text-xs text-emerald-400 font-normal">accepted</span>
                ) : null}
              </h2>
            </div>
            {data.plan.notes.length > 0 && (
              <ul className="text-xs text-amber-200/80 space-y-1">
                {data.plan.notes.map(n => (
                  <li key={n}>· {n}</li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              {data.plan.days.map(day => (
                <div
                  key={day.date}
                  className={`rounded-xl border px-3 py-2.5 ${
                    day.isLong
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-pens-muted/20 bg-pens-navy/30'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-pens-cream w-24">{day.weekday}</span>
                    <span className="text-sm text-pens-cream/85">{day.title}</span>
                    {day.sport && (
                      <span className="text-[10px] uppercase tracking-wide text-orange-300/80">
                        {day.sport}
                      </span>
                    )}
                    {day.minutes > 0 && (
                      <span className="text-xs text-pens-cream/40 ml-auto">{day.minutes} min</span>
                    )}
                  </div>
                  <p className="text-xs text-pens-cream/45 mt-1">{day.why}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={saving || Boolean(data.saved?.accepted)}
              onClick={() => void acceptWeek()}
              className="text-sm px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
            >
              {data.saved?.accepted ? 'Week accepted' : 'Accept this week'}
            </button>
          </section>
        )}
      </div>
    </main>
  )
}
