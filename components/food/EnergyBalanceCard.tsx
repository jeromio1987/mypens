'use client'

import { useEffect, useState } from 'react'

type Source = {
  id: string
  label: string
  kcal: number
  origin: string
  detail?: string
}

type Balance = {
  date: string
  foodKcal: number
  activityKcal: number
  delta: number
  incompleteCapture: boolean
  sources: Source[]
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

  return (
    <div className="bg-pens-surface rounded-2xl p-4 border border-amber-500/25 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold">Energy ledger</p>
          <p className="text-sm text-pens-cream/70 mt-0.5">Food in vs logged activity burn · {data.date}</p>
        </div>
        <div className={`text-right ${surplus ? 'text-amber-300' : 'text-sky-300'}`}>
          <p className="text-xs text-pens-cream/40">{surplus ? 'surplus vs burn' : 'under vs burn'}</p>
          <p className="text-xl font-semibold tabular-nums">
            {surplus ? '+' : ''}{data.delta}
            <span className="text-sm font-normal text-pens-cream/50"> kcal</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">Food logged</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.foodKcal} <span className="text-xs text-pens-cream/50">kcal</span></p>
        </div>
        <div className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">Activity burn</p>
          <p className="text-lg tabular-nums text-pens-cream">{data.activityKcal} <span className="text-xs text-pens-cream/50">kcal</span></p>
        </div>
      </div>

      {data.incompleteCapture && (
        <p className="text-xs text-amber-200/80 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2">
          Activities exist for this day but no kcal was found on them — capture may be incomplete.
        </p>
      )}

      {data.sources.length > 0 && (
        <ul className="space-y-1.5 border-t border-pens-muted/20 pt-3">
          {data.sources.map(s => (
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

      <p className="text-[10px] text-pens-cream/35 leading-relaxed">{data.disclaimer}</p>
    </div>
  )
}
