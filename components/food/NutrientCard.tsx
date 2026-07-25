'use client'

import { useEffect, useState } from 'react'
import type { DailyTargets } from '@/lib/foodModels'
import {
  MICRO_LABELS,
  parseMicrosJson,
  parseTagsJson,
  softNutrientFlags,
  sumMicros,
  type SoftNutrientFlag,
} from '@/lib/foodMicros'

type FoodRow = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  microsJson?: string | null
  tagsJson?: string | null
}

const TAG_LABELS: Record<string, string> = {
  high_protein: 'Higher protein',
  high_fiber: 'Higher fiber',
  ultra_processed_guess: 'UPF guess',
  plant_forward: 'Plant-forward',
  dairy: 'Dairy',
  contains_alcohol: 'Alcohol',
}

export default function NutrientCard({
  date,
  refresh = 0,
  targets,
}: {
  date: string
  refresh?: number
  targets: DailyTargets
}) {
  const [rows, setRows] = useState<FoodRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/food?date=${encodeURIComponent(date)}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setRows(Array.isArray(j) ? j : [])
      })
      .catch(e => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [date, refresh])

  if (err) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-red-300">
        Nutrients: {err}
      </div>
    )
  }
  if (!rows) {
    return (
      <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 text-sm text-pens-cream/40">
        Loading nutrient day…
      </div>
    )
  }
  if (rows.length === 0) return null

  const fiberG = rows.reduce((s, r) => s + (r.fiberG || 0), 0)
  const proteinG = rows.reduce((s, r) => s + (r.proteinG || 0), 0)
  const micros = sumMicros(rows.map(r => parseMicrosJson(r.microsJson)))
  const tagCounts = new Map<string, number>()
  for (const r of rows) {
    for (const t of parseTagsJson(r.tagsJson)) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const flags: SoftNutrientFlag[] = softNutrientFlags({
    fiberG,
    proteinG,
    proteinTarget: targets.proteinG,
    micros,
  })
  const microEntries = Object.entries(micros).filter(([, v]) => v > 0)

  return (
    <div className="bg-pens-surface rounded-2xl p-4 border border-amber-500/25 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-amber-400/90 font-semibold">Nutrient day</p>
        <p className="text-sm text-pens-cream/70 mt-0.5">
          Soft ledger from logged food · fiber {Math.round(fiberG)}g · protein {Math.round(proteinG)}g
        </p>
      </div>

      {microEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {microEntries.slice(0, 9).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-pens-navy/60 border border-pens-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-pens-cream/40">
                {MICRO_LABELS[k] ?? k}
              </p>
              <p className="text-sm tabular-nums text-pens-cream">
                {v % 1 === 0 ? v : v.toFixed(1)}
                <span className="text-[10px] text-pens-cream/45 ml-1">
                  {k.endsWith('Mcg') ? 'µg' : k.endsWith('Mg') ? 'mg' : ''}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {tagCounts.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...tagCounts.entries()].map(([t, n]) => (
            <span
              key={t}
              className="text-[10px] px-2 py-1 rounded-lg bg-amber-900/25 border border-amber-500/20 text-amber-100/80"
            >
              {TAG_LABELS[t] ?? t.replace(/_/g, ' ')}
              {n > 1 ? ` ×${n}` : ''}
            </span>
          ))}
        </div>
      )}

      {flags.length > 0 && (
        <ul className="space-y-1.5 border-t border-pens-muted/20 pt-3">
          {flags.map(f => (
            <li key={f.id} className="text-xs text-pens-cream/65 leading-relaxed">
              {f.message}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-pens-cream/35 leading-relaxed">
        Micros only appear when Open Food Facts or photo analysis provided them. Not medical advice.
      </p>
    </div>
  )
}
