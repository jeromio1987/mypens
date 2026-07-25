'use client'

import { useEffect, useState } from 'react'

type WeekDay = {
  date: string
  foodKcal: number
  activityKcal: number
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

type Recap = {
  window: { from: string; to: string }
  days: WeekDay[]
  summary: {
    daysTracked: number
    daysImputed: number
    weekNetKcal: number
    trackedNetKcal: number
    avgDailyNetKcal: number
    foodKcalTotal: number
    activityKcalTotal: number
    bmrKcalTotal: number
    bmrMissingDays: number
    disclaimer: string
  }
  calibration: Calibration | null
}

export default function WeekEnergyRecapCard({
  asOf,
  refresh = 0,
  compact = false,
}: {
  asOf: string
  refresh?: number
  compact?: boolean
}) {
  const [data, setData] = useState<Recap | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    fetch(`/api/energy-balance?week=1&date=${encodeURIComponent(asOf)}`)
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
  }, [asOf, refresh])

  if (err) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-red-300">
        Week energy: {err}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-pens-cream/40">
        Loading week ledger…
      </div>
    )
  }

  const net = data.summary.weekNetKcal
  const surplus = net >= 0

  if (compact) {
    return (
      <div className="bg-pens-surface rounded-2xl px-4 py-3 border border-amber-500/20 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold">7-day ledger</p>
          <p className="text-xs text-pens-cream/50 truncate">
            {data.window.from} → {data.window.to} · {data.summary.daysTracked} tracked
            {data.summary.daysImputed ? ` · ${data.summary.daysImputed} imputed` : ''}
          </p>
        </div>
        <p className={`text-lg font-semibold tabular-nums shrink-0 ${surplus ? 'text-amber-300' : 'text-sky-300'}`}>
          {surplus ? '+' : ''}
          {net}
          <span className="text-xs font-normal text-pens-cream/50"> kcal</span>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-pens-surface rounded-2xl p-4 border border-amber-500/25 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold">
            Weekly energy recap
          </p>
          <p className="text-sm text-pens-cream/70 mt-0.5">
            Rolling 7 days · {data.window.from} → {data.window.to}
          </p>
        </div>
        <div className={`text-right ${surplus ? 'text-amber-300' : 'text-sky-300'}`}>
          <p className="text-xs text-pens-cream/40">{surplus ? 'week surplus' : 'week deficit'}</p>
          <p className="text-xl font-semibold tabular-nums">
            {surplus ? '+' : ''}
            {net}
            <span className="text-sm font-normal text-pens-cream/50"> kcal</span>
          </p>
          <p className="text-[10px] text-pens-cream/40 tabular-nums">
            avg {surplus ? '+' : ''}
            {data.summary.avgDailyNetKcal}/day
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">Food</p>
          <p className="tabular-nums text-pens-cream">{data.summary.foodKcalTotal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">Activity</p>
          <p className="tabular-nums text-pens-cream">{data.summary.activityKcalTotal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-2 py-2">
          <p className="text-[10px] uppercase text-pens-cream/40">BMR stub</p>
          <p className="tabular-nums text-pens-cream">{data.summary.bmrKcalTotal}</p>
        </div>
      </div>

      <p className="text-xs text-pens-cream/55">
        {data.summary.daysTracked} tracked · {data.summary.daysImputed} imputed
        {data.summary.bmrMissingDays > 0
          ? ` · ${data.summary.bmrMissingDays}d without weight (BMR=0)`
          : ''}
      </p>

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

      <p className="text-[10px] text-pens-cream/35 leading-relaxed">{data.summary.disclaimer}</p>
    </div>
  )
}
