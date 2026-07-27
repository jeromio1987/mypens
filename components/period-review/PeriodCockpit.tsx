'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, CalendarRange, Activity, HeartPulse, Dumbbell, Scale } from 'lucide-react'
import { fromDateStr, shiftDateStr, toDateStr } from '@/lib/weekDates'

type Tab = 'read' | 'timeline' | 'body' | 'training' | 'composition' | 'cause'

type SeriesDay = {
  date: string
  formScore: number | null
  sleepHours: number | null
  stress: number | null
  hrv: number | null
  restingHr: number | null
  rhrBand: string | null
  steps: number | null
  activityMinutes: number
  activityCount: number
  trainingLoad?: number
  hardLoad?: number
  easyLoad?: number
}

type Cockpit = {
  from: string
  to: string
  theRead: {
    verdict: string | null
    avgForm: number | null
    leadingCause: { id: string; label: string; confidence: number } | null
    topRisk: string | null
    topWin: string | null
    nextAction: string
    headline: string
  }
  series: SeriesDay[]
  thresholds: { rhrLikely: number; rhrHeavy: number }
  ledger?: {
    totalRows: number
    sleep: { count: number; from: string | null; to: string | null }
    activities: { count: number; from: string | null; to: string | null }
    trainings: { count: number; from: string | null; to: string | null }
  }
  rawCounts?: {
    sleep: number
    activities: number
    trainings: number
    weights: number
    metrics: number
  } | null
  suggestedSpan?: { from: string; to: string } | null
  loadNotes?: string[]
  causal: {
    topHypothesis?: { id: string; label: string; confidence: number; text?: string } | null
    narrative?: string
    rhrLadder?: { likelyDrinkingDays?: number; heavyStackDays?: number }
    hypotheses?: Array<{ id: string; label: string; confidence: number; text: string }>
  }
  periods: { deepAnalysis?: string; headline?: string }
  inventory: Record<string, number>
}

const PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6m', days: 183 },
  { label: '12m', days: 365 },
]

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'read', label: 'The Read', icon: CalendarRange },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'body', label: 'Body', icon: HeartPulse },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'composition', label: 'Composition', icon: Scale },
  { id: 'cause', label: 'Cause', icon: HeartPulse },
]

function verdictClass(v: string | null | undefined) {
  if (v === 'good') return 'bg-emerald-900/50 text-emerald-300'
  if (v === 'bad') return 'bg-red-900/40 text-red-300'
  if (v === 'mixed') return 'bg-amber-900/40 text-amber-200'
  return 'bg-pens-muted/30 text-pens-cream/50'
}

export default function PeriodCockpit() {
  const today = toDateStr(new Date())
  const [to, setTo] = useState(today)
  const [from, setFrom] = useState(shiftDateStr(today, -89))
  const [tab, setTab] = useState<Tab>('read')
  const [cockpit, setCockpit] = useState<Cockpit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Last day that has any ledger rows — presets/zoom anchor here, not "today". */
  const [ledgerTo, setLedgerTo] = useState<string | null>(null)
  const [ledgerFrom, setLedgerFrom] = useState<string | null>(null)
  const [labsChip, setLabsChip] = useState<{
    present: boolean
    chipLabel: string
    panelId: string | null
    flaggedCount: number
  } | null>(null)
  const autoClampedRef = useRef(false)

  const effectiveTo = ledgerTo && ledgerTo < today ? ledgerTo : today

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/period-review?from=${f}&to=${t}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const next: Cockpit | null = data.cockpit ?? null
      setCockpit(next)

      const span = next?.suggestedSpan
      if (span?.from && span?.to) {
        setLedgerFrom(span.from)
        setLedgerTo(span.to)
        // First successful load: if zoom runs past the last real day, snap to ledger end
        // and keep roughly the same window length (default 90d).
        if (!autoClampedRef.current && t > span.to) {
          autoClampedRef.current = true
          const spanDays = Math.max(
            1,
            Math.round(
              (fromDateStr(t).getTime() - fromDateStr(f).getTime()) / 86_400_000,
            ) + 1,
          )
          const newTo = span.to
          let newFrom = shiftDateStr(newTo, -(spanDays - 1))
          if (newFrom < span.from) newFrom = span.from
          setFrom(newFrom)
          setTo(newTo)
          return
        }
      }
      autoClampedRef.current = true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setCockpit(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(from, to)
  }, [from, to, load])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bloodwork/latest-summary')
      .then(async r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j?.present) {
          if (!cancelled) setLabsChip(null)
          return
        }
        setLabsChip({
          present: true,
          chipLabel: j.chipLabel,
          panelId: j.panelId ?? null,
          flaggedCount: j.flaggedCount ?? 0,
        })
      })
      .catch(() => {
        if (!cancelled) setLabsChip(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const applyPreset = (days: number) => {
    const end = effectiveTo
    const startCandidate = shiftDateStr(end, -(days - 1))
    const start =
      ledgerFrom && startCandidate < ledgerFrom ? ledgerFrom : startCandidate
    setTo(end)
    setFrom(start)
  }

  const series = useMemo(() => cockpit?.series ?? [], [cockpit])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-pens-cream/40 hover:text-pens-cream/70">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-semibold">
              Engine cockpit
            </p>
            <h1 className="text-2xl font-bold text-pens-cream">Period Review</h1>
          </div>
          <Link
            href="/planner"
            className="ml-auto text-xs px-3 py-1.5 rounded-full border border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
          >
            Sports planner →
          </Link>
        </div>

        {/* Range controls */}
        <div className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="text-xs px-3 py-1 rounded-full border border-pens-muted/30 text-pens-cream/70 hover:border-cyan-500/40 hover:text-cyan-300"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs text-pens-cream/50">
              From
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="mt-1 block rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-2 py-1.5 text-pens-cream text-sm"
              />
            </label>
            <label className="text-xs text-pens-cream/50">
              To
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="mt-1 block rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-2 py-1.5 text-pens-cream text-sm"
              />
            </label>
            <p className="text-xs text-pens-cream/40 pb-2">
              Zoom the window — The Read, graphs, and cause all reflow.
              {ledgerTo && (
                <span className="text-cyan-400/70">
                  {' '}
                  Auto-ends at last ledger day ({ledgerTo}
                  {ledgerTo < today ? ' — no rows after that yet' : ''}).
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-pens-muted/20 pb-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg ${
                  active
                    ? 'bg-pens-surface text-pens-cream border border-b-0 border-pens-muted/30'
                    : 'text-pens-cream/45 hover:text-pens-cream/70'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>

        {loading && <p className="text-pens-cream/50 text-sm">Loading window…</p>}
        {error && (
          <p className="text-red-300 text-sm">
            {error}
            <span className="block text-pens-cream/40 mt-1">
              If the DB is empty, run analyze:periods locally first — live cockpit still needs rows.
            </span>
          </p>
        )}

        {!loading && cockpit?.loadNotes && cockpit.loadNotes.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-200">
              {(cockpit.inventory?.days || 0) > 0 ? 'Data gaps in this window' : 'Why this window looks empty'}
            </p>
            {cockpit.loadNotes.map(n => (
              <p key={n} className="text-sm text-amber-100/80">
                {n}
              </p>
            ))}
            {cockpit.ledger && (
              <p className="text-xs text-pens-cream/50">
                Ledger totals — sleep {cockpit.ledger.sleep.count}
                {cockpit.ledger.sleep.from
                  ? ` (${cockpit.ledger.sleep.from}→${cockpit.ledger.sleep.to})`
                  : ''}
                · Garmin {cockpit.ledger.activities.count}
                {cockpit.ledger.activities.from
                  ? ` (${cockpit.ledger.activities.from}→${cockpit.ledger.activities.to})`
                  : ''}
                · training {cockpit.ledger.trainings.count}
              </p>
            )}
            {cockpit.rawCounts && (
              <p className="text-xs text-pens-cream/40">
                Raw table counts — sleep {cockpit.rawCounts.sleep} · Garmin{' '}
                {cockpit.rawCounts.activities} · training {cockpit.rawCounts.trainings} · weight{' '}
                {cockpit.rawCounts.weights} · metrics {cockpit.rawCounts.metrics}
              </p>
            )}
            {cockpit.suggestedSpan && (
              <button
                type="button"
                className="mt-1 text-xs px-3 py-1.5 rounded-full border border-amber-400/50 text-amber-100 hover:bg-amber-500/10"
                onClick={() => {
                  setFrom(cockpit.suggestedSpan!.from)
                  setTo(cockpit.suggestedSpan!.to)
                }}
              >
                Use full ledger span ({cockpit.suggestedSpan.from} → {cockpit.suggestedSpan.to})
              </button>
            )}
          </div>
        )}

        {!loading && cockpit && tab === 'read' && (
          <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-pens-cream">The Read</h2>
              {cockpit.theRead.verdict && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full ${verdictClass(cockpit.theRead.verdict)}`}>
                  {cockpit.theRead.verdict}
                  {cockpit.theRead.avgForm != null ? ` · Form ${cockpit.theRead.avgForm}` : ''}
                </span>
              )}
            </div>
            <p className="text-pens-cream/80 leading-relaxed">{cockpit.theRead.headline}</p>
            <ul className="space-y-2 text-sm text-pens-cream/75">
              {cockpit.theRead.leadingCause && (
                <li>
                  <span className="text-pens-cream/40">Leading cause · </span>
                  {cockpit.theRead.leadingCause.label} (
                  {Math.round(cockpit.theRead.leadingCause.confidence * 100)}%)
                </li>
              )}
              {cockpit.theRead.topRisk && (
                <li>
                  <span className="text-amber-400/80">Risk · </span>
                  {cockpit.theRead.topRisk}
                </li>
              )}
              {cockpit.theRead.topWin && (
                <li>
                  <span className="text-emerald-400/80">Win · </span>
                  {cockpit.theRead.topWin}
                </li>
              )}
              <li>
                <span className="text-cyan-400/80">Next · </span>
                {cockpit.theRead.nextAction}
              </li>
            </ul>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {[
                ['Nights', cockpit.inventory.nights],
                ['Garmin', cockpit.inventory.activities],
                ['Training', cockpit.inventory.trainings],
                ['Days', cockpit.inventory.days],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl bg-pens-navy/40 px-3 py-2">
                  <p className="text-[10px] uppercase text-pens-cream/40">{k}</p>
                  <p className="text-lg font-semibold text-pens-cream">{v}</p>
                </div>
              ))}
            </div>
            {labsChip?.present ? (
              <Link
                href={labsChip.panelId ? `/bloodwork/${labsChip.panelId}` : '/bloodwork'}
                className={`inline-flex text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
                  labsChip.flaggedCount > 0
                    ? 'border-violet-400/40 text-violet-200/90 bg-violet-950/30'
                    : 'border-pens-muted/30 text-pens-cream/55 bg-pens-navy/40'
                }`}
              >
                {labsChip.chipLabel}
              </Link>
            ) : null}
          </section>
        )}

        {!loading && cockpit && tab === 'timeline' && (
          <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5">
            <h2 className="text-sm font-semibold text-cyan-300 mb-3">
              Form score
              <span className="ml-2 text-[10px] font-normal text-pens-cream/40">
                (slaap + HRV + rust-HR + belasting — uitleg in cockpit)
              </span>
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243049" />
                  <XAxis dataKey="date" tick={{ fill: '#93a0b8', fontSize: 10 }} minTickGap={40} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#93a0b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#121a2b', border: '1px solid #243049' }}
                    labelStyle={{ color: '#e8eefc' }}
                  />
                  <ReferenceLine y={65} stroke="#34d39955" strokeDasharray="4 4" />
                  <ReferenceLine y={45} stroke="#fbbf2455" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="formScore"
                    stroke="#22d3ee"
                    fill="#22d3ee33"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-pens-cream/40 mt-2">
              Green band ≥65 · amber 45–64 · red below 45. Same window as The Read.
            </p>
          </section>
        )}

        {!loading && cockpit && tab === 'body' && (
          <section className="space-y-4">
            <ChartCard title="Resting HR (drink ladder)" data={series} dataKey="restingHr" color="#f87171">
              <ReferenceLine y={50} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: '≥50 drink', fill: '#fbbf24', fontSize: 10 }} />
              <ReferenceLine y={55} stroke="#f87171" strokeDasharray="4 4" label={{ value: '≥55 heavy', fill: '#f87171', fontSize: 10 }} />
            </ChartCard>
            <div className="grid sm:grid-cols-2 gap-4">
              <ChartCard title="Sleep hours" data={series} dataKey="sleepHours" color="#818cf8" />
              <ChartCard title="HRV" data={series} dataKey="hrv" color="#34d399" />
              <ChartCard title="Stress" data={series} dataKey="stress" color="#fbbf24" />
              <ChartCard title="Steps" data={series} dataKey="steps" color="#60a5fa" />
            </div>
          </section>
        )}

        {!loading && cockpit && tab === 'training' && (
          <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-orange-300 mb-1">Training load (belasting)</h2>
              <p className="text-xs text-pens-cream/45 leading-relaxed">
                Schatting van hoe zwaar sessies waren: duur × sportsoort × hartslag. Wandelen telt licht;
                kracht/HIIT zwaar. Oranje = totale belasting · amber gestippeld = rustige beweging · grijs =
                ruwe minuten.
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243049" />
                  <XAxis dataKey="date" tick={{ fill: '#93a0b8', fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fill: '#93a0b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#121a2b', border: '1px solid #243049' }} />
                  <Area
                    type="monotone"
                    dataKey="trainingLoad"
                    name="Belasting"
                    stroke="#fb923c"
                    fill="#fb923c33"
                  />
                  <Line
                    type="monotone"
                    dataKey="easyLoad"
                    name="Rustige beweging"
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="activityMinutes"
                    name="Ruwe minuten"
                    stroke="#64748b"
                    dot={false}
                    strokeWidth={1}
                    strokeOpacity={0.7}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-pens-cream/40">
              Includes Garmin activities + Strava/manual training rows. Form uses load units (PLU) —
              kept off the main chips; not raw minutes.
            </p>
          </section>
        )}

        {!loading && cockpit && tab === 'composition' && (
          <section className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-5">
            <h2 className="text-sm font-semibold text-purple-300 mb-2">Composition</h2>
            <p className="text-sm text-pens-cream/60">
              Tanita weigh-ins in this window: {cockpit.inventory.weights}. Full BF% trend chart lands when
              live weight series is wired into the cockpit series (weight rows are already loaded for
              causal). Use `/weight` for the detailed composition charts today.
            </p>
          </section>
        )}

        {!loading && cockpit && tab === 'cause' && (
          <section className="rounded-2xl border border-red-900/40 bg-gradient-to-br from-red-950/40 to-pens-surface/80 p-5 space-y-4">
            <h2 className="text-lg font-bold text-pens-cream">
              {cockpit.causal.topHypothesis?.label || 'No clear leading cause'}
              {cockpit.causal.topHypothesis && (
                <span className="text-sm font-normal text-pens-cream/50 ml-2">
                  {Math.round(cockpit.causal.topHypothesis.confidence * 100)}%
                </span>
              )}
            </h2>
            {(cockpit.causal.rhrLadder?.likelyDrinkingDays || 0) > 0 && (
              <p className="text-sm text-amber-200/90">
                RHR ladder: {cockpit.causal.rhrLadder?.likelyDrinkingDays} day(s) ≥50 (likely drinking),{' '}
                {cockpit.causal.rhrLadder?.heavyStackDays || 0} day(s) ≥55 (heavy stack).
              </p>
            )}
            <p className="text-sm text-pens-cream/80 whitespace-pre-wrap leading-relaxed">
              {cockpit.causal.narrative}
            </p>
            <ul className="space-y-3">
              {(cockpit.causal.hypotheses || []).map(h => (
                <li key={h.id} className="text-sm border-l-2 border-pens-muted/40 pl-3">
                  <p className="font-semibold text-pens-cream/90">
                    {h.label}{' '}
                    <span className="text-pens-cream/40 font-normal">
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </p>
                  <p className="text-pens-cream/60 mt-1">{h.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

function ChartCard({
  title,
  data,
  dataKey,
  color,
  children,
}: {
  title: string
  data: SeriesDay[]
  dataKey: keyof SeriesDay
  color: string
  children?: React.ReactNode
}) {
  const hasPoints = data.some(d => {
    const v = d[dataKey]
    return typeof v === 'number' && !Number.isNaN(v)
  })
  return (
    <div className="rounded-2xl border border-pens-muted/20 bg-pens-surface/80 p-4">
      <h3 className="text-xs font-semibold text-pens-cream/60 mb-2">{title}</h3>
      <div className="h-44 relative">
        {!hasPoints && (
          <p className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-xs text-pens-cream/45">
            No {title} rows in this window — Form score is weaker without it. Re-import Garmin wellness
            (HRV/stress) if this stays empty.
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243049" />
            <XAxis dataKey="date" tick={{ fill: '#93a0b8', fontSize: 9 }} minTickGap={50} />
            <YAxis tick={{ fill: '#93a0b8', fontSize: 9 }} width={36} />
            <Tooltip contentStyle={{ background: '#121a2b', border: '1px solid #243049' }} />
            {children}
            <Line
              type="monotone"
              dataKey={dataKey as string}
              stroke={color}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
