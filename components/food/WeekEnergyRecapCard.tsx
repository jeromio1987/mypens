'use client'

import { useEffect, useState } from 'react'

type WeekDay = {
  date: string
  foodKcal: number
  activityKcal: number
  eatKcal?: number
  neatKcal?: number
  bmrKcal: number
  estimatedOut: number
  delta: number
  tracked: boolean
  imputed: boolean
  bmrMissing: boolean
}

type Calibration = {
  predictedKg: number
  observedKg: number
  residualKg: number
  residualKcal: number
  note: string
  disclaimer: string
  weightStart: { date: string; scaleKg: number }
  weightEnd: { date: string; scaleKg: number }
}

type ThyroidContext = {
  present: boolean
  title: string
  summary: string
  disclaimer: string
}

type Recap = {
  window: { from: string; to: string }
  windowDays?: number
  days: WeekDay[]
  summary: {
    daysTracked: number
    daysImputed: number
    weekNetKcal: number
    trackedNetKcal: number
    avgDailyNetKcal: number
    foodKcalTotal: number
    activityKcalTotal: number
    eatKcalTotal?: number
    neatKcalTotal?: number
    bmrKcalTotal: number
    bmrMissingDays: number
    disclaimer: string
  }
  calibration: Calibration | null
  thyroidContext?: ThyroidContext | null
}

export default function WeekEnergyRecapCard({
  asOf,
  refresh = 0,
  compact = false,
  windowDays = 7,
  defaultCollapsed = false,
}: {
  asOf: string
  refresh?: number
  compact?: boolean
  /** 7 or 30 */
  windowDays?: 7 | 30
  /** When true, show a one-line summary until expanded (Fueling scroll tax). */
  defaultCollapsed?: boolean
}) {
  const [data, setData] = useState<Recap | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(!defaultCollapsed)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    const q =
      windowDays === 30
        ? `/api/energy-balance?month=1&date=${encodeURIComponent(asOf)}`
        : `/api/energy-balance?week=1&date=${encodeURIComponent(asOf)}`
    fetch(q)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setData(j)
      })
      .catch(e => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [asOf, refresh, windowDays])

  if (err) {
    return (
      <div className="bg-ct-bloodc px-5 py-4 text-sm text-ct-blood">
        {windowDays}-day energy: {err}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="bg-ct-high px-5 py-4 text-sm text-ct-second/45">
        Loading {windowDays}-day ledger…
      </div>
    )
  }

  const net = data.summary.weekNetKcal
  const surplus = net >= 0
  const label = windowDays === 30 ? '30-day ledger' : '7-day ledger'

  if (compact) {
    return (
      <div className="bg-ct-high px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-second/55">{label}</p>
          <p className="text-xs text-ct-second/50 truncate">
            {data.window.from} → {data.window.to} · {data.summary.daysTracked} tracked
            {data.summary.daysImputed ? ` · ${data.summary.daysImputed} imputed` : ''}
          </p>
        </div>
        <p className={`font-headline text-lg tabular-nums shrink-0 ${surplus ? 'text-ct-blood' : 'text-ct-second'}`}>
          {surplus ? '+' : ''}
          {net}
          <span className="ml-1 font-grotesk text-xs font-normal text-ct-second/50">kcal</span>
        </p>
      </div>
    )
  }

  if (defaultCollapsed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left bg-ct-high px-4 py-3 flex items-center justify-between gap-3 hover:bg-ct-highest transition-colors"
      >
        <div className="min-w-0">
          <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-second/55">{label}</p>
          <p className="text-xs text-ct-second/50 truncate">
            {data.window.from} → {data.window.to} · tap to expand
          </p>
        </div>
        <p className={`font-headline text-lg tabular-nums shrink-0 ${surplus ? 'text-ct-blood' : 'text-ct-second'}`}>
          {surplus ? '+' : ''}
          {net}
          <span className="ml-1 font-grotesk text-xs font-normal text-ct-second/50">kcal</span>
        </p>
      </button>
    )
  }

  return (
    <div className="bg-ct-high px-5 py-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-second/55">
            {windowDays === 30 ? '30-day energy recap' : 'Weekly energy recap'}
          </p>
          <p className="text-sm text-ct-second/65 mt-0.5">
            Rolling {windowDays} days · {data.window.from} → {data.window.to}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <div className={`text-right ${surplus ? 'text-ct-blood' : 'text-ct-second'}`}>
            <p className="text-xs text-ct-second/40">{surplus ? 'window surplus' : 'window deficit'}</p>
            <p className="font-headline text-xl tabular-nums leading-none">
              {surplus ? '+' : ''}
              {net}
              <span className="text-sm font-normal text-pens-cream/50"> kcal</span>
            </p>
            <p className="text-[10px] text-pens-cream/40 tabular-nums">
              avg {surplus ? '+' : ''}
              {data.summary.avgDailyNetKcal}/day
            </p>
          </div>
          {defaultCollapsed ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-pens-cream/40 hover:text-pens-cream/70 px-1"
            >
              Hide
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">Food</p>
          <p className="tabular-nums text-pens-cream">{data.summary.foodKcalTotal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">EAT</p>
          <p className="tabular-nums text-pens-cream">{data.summary.eatKcalTotal ?? '—'}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">NEAT</p>
          <p className="tabular-nums text-pens-cream">{data.summary.neatKcalTotal ?? '—'}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">BMR</p>
          <p className="tabular-nums text-pens-cream">{data.summary.bmrKcalTotal}</p>
        </div>
      </div>

      <p className="text-xs text-pens-cream/55">
        {data.summary.daysTracked} tracked · {data.summary.daysImputed} imputed
        {data.summary.bmrMissingDays > 0
          ? ` · ${data.summary.bmrMissingDays}d without weight (BMR=0)`
          : ''}
      </p>

      {windowDays === 7 && (
        <ul className="space-y-1 border-t border-pens-muted/20 pt-3">
          {data.days.map(d => (
            <li key={d.date} className="flex justify-between gap-2 text-xs text-pens-cream/70">
              <span className="min-w-0 truncate">
                {d.date.slice(5)}
                {d.imputed ? (
                  <span className="ml-1 text-amber-400/70">imputed</span>
                ) : null}
              </span>
              <span className={`tabular-nums shrink-0 ${d.delta >= 0 ? 'text-amber-200/80' : 'text-sky-200/80'}`}>
                {d.delta >= 0 ? '+' : ''}
                {d.delta}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.calibration && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300/90 font-semibold">
            Estimate vs scale
          </p>
          <p className="text-xs text-pens-cream/75 leading-relaxed">{data.calibration.note}</p>
          <p className="text-[10px] text-pens-cream/45 tabular-nums">
            Ledger ≈ {data.calibration.predictedKg >= 0 ? '+' : ''}
            {data.calibration.predictedKg} kg · scale{' '}
            {data.calibration.weightStart.scaleKg.toFixed(1)} → {data.calibration.weightEnd.scaleKg.toFixed(1)} (
            {data.calibration.observedKg >= 0 ? '+' : ''}
            {data.calibration.observedKg} kg)
          </p>
          <p className="text-[10px] text-pens-cream/35">{data.calibration.disclaimer}</p>
        </div>
      )}

      {data.thyroidContext?.present && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/15 px-3 py-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-violet-300/90 font-semibold">
            {data.thyroidContext.title} (context only)
          </p>
          <p className="text-xs text-pens-cream/70 leading-relaxed">{data.thyroidContext.summary}</p>
          <p className="text-[10px] text-pens-cream/35">{data.thyroidContext.disclaimer}</p>
        </div>
      )}

      <p className="text-[10px] text-pens-cream/35 leading-relaxed">{data.summary.disclaimer}</p>
    </div>
  )
}
