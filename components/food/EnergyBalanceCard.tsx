'use client'

import { useEffect, useState } from 'react'

type Source = {
  id: string
  label: string
  kcal: number
  origin: string
  detail?: string
}

type DeviceRef = {
  steps: number | null
  activeKcal: number | null
  restingKcal: number | null
  totalKcal: number | null
  note: string
}

type Balance = {
  date: string
  foodKcal: number
  eatKcal: number
  neatKcal: number
  bmrKcal: number
  bmrLabel: string
  activityKcal: number
  estimatedOut: number
  delta: number
  incompleteCapture: boolean
  sources: Source[]
  neatDetail?: string
  deviceRef: DeviceRef | null
  disclaimer: string
}

export default function EnergyBalanceCard({ date, refresh = 0 }: { date: string; refresh?: number }) {
  const [data, setData] = useState<Balance | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    fetch(`/api/energy-balance?date=${encodeURIComponent(date)}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setData(j)
      })
      .catch(e => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed')
      })
    return () => { cancelled = true }
  }, [date, refresh])

  if (err) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-red-300">
        Energy balance: {err}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-pens-cream/40">
        Loading energy ledger…
      </div>
    )
  }

  const surplus = data.delta >= 0
  const sessionSources = data.sources.filter(s =>
    s.origin === 'garmin_activity' || s.origin === 'training' || s.origin === 'notes' || s.origin === 'pushed',
  )
  const steps = data.deviceRef?.steps

  return (
    <div className="bg-pens-surface rounded-2xl p-4 border border-amber-500/25 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold">Energy ledger</p>
          <p className="text-sm text-pens-cream/70 mt-0.5">
            Food − (BMR + EAT + NEAT) · {data.date}
          </p>
        </div>
        <div className={`text-right ${surplus ? 'text-amber-300' : 'text-sky-300'}`}>
          <p className="text-xs text-pens-cream/40">{surplus ? 'surplus vs stack' : 'under vs stack'}</p>
          <p className="text-xl font-semibold tabular-nums">
            {surplus ? '+' : ''}{data.delta}
            <span className="text-sm font-normal text-pens-cream/50"> kcal</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">Food</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.foodKcal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">BMR</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.bmrKcal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">EAT</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.eatKcal}</p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">NEAT</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.neatKcal}</p>
        </div>
      </div>

      {(steps != null || data.neatDetail) && (
        <p className="text-xs text-pens-cream/55">
          {steps != null ? `Steps ${steps.toLocaleString()}` : 'Steps —'}
          {data.neatDetail ? ` · ${data.neatDetail}` : ''}
        </p>
      )}

      {data.incompleteCapture && (
        <p className="text-xs text-amber-200/80 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
          Activities exist for this day but no session kcal was found — capture may be incomplete. Re-sync Garmin/HC after the workout finishes processing.
        </p>
      )}

      {sessionSources.length > 0 && (
        <ul className="space-y-1.5 border-t border-pens-muted/20 pt-3">
          {sessionSources.map(s => (
            <li key={s.id} className="flex justify-between gap-2 text-xs text-pens-cream/70">
              <span className="min-w-0 truncate">
                {s.label}
                {s.detail ? <span className="text-pens-cream/40"> · {s.detail}</span> : null}
              </span>
              <span className="tabular-nums shrink-0 text-pens-cream/90">{s.kcal} kcal</span>
            </li>
          ))}
        </ul>
      )}

      {data.deviceRef && (data.deviceRef.totalKcal != null || data.deviceRef.activeKcal != null) && (
        <div className="rounded-xl border border-slate-500/25 bg-slate-950/30 px-3 py-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-300/90 font-semibold">
            Garmin day reference (not added to stack)
          </p>
          <p className="text-xs text-pens-cream/70 tabular-nums">
            MY PENS out {data.estimatedOut}
            {data.deviceRef.totalKcal != null ? ` · Garmin Total ${data.deviceRef.totalKcal}` : ''}
            {data.deviceRef.activeKcal != null ? ` · Active ${data.deviceRef.activeKcal}` : ''}
            {data.deviceRef.restingKcal != null ? ` · Resting ${data.deviceRef.restingKcal}` : ''}
          </p>
          <p className="text-[10px] text-pens-cream/35">{data.deviceRef.note}</p>
        </div>
      )}

      <p className="text-[10px] text-pens-cream/35 leading-relaxed">{data.disclaimer}</p>
      {data.bmrLabel ? (
        <p className="text-[10px] text-pens-cream/30">{data.bmrLabel}</p>
      ) : null}
    </div>
  )
}
