'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FLAG_CHIP, type RefFlag } from '@/lib/bloodworkFlags'

type ChartPoint = {
  drawDate: string
  panelId: string
  value: number
  flag: RefFlag
}

type ChartSeries = {
  code: string
  label: string
  unit: string | null
  refLow: number | null
  refHigh: number | null
  group: string
  points: ChartPoint[]
  prior: number | null
  latest: number | null
  deltaPct: number | null
  latestFlag: RefFlag
}

type ChartPayload = {
  panels: Array<{ id: string; drawDate: string; labName: string | null; markerCount: number }>
  series: ChartSeries[]
  disclaimer: string
}

function scaleBounds(s: ChartSeries): { min: number; max: number } {
  const vals = s.points.map(p => p.value)
  if (s.refLow != null) vals.push(s.refLow)
  if (s.refHigh != null) vals.push(s.refHigh)
  if (vals.length === 0) return { min: 0, max: 1 }
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  if (lo === hi) return { min: lo * 0.85, max: hi * 1.15 || 1 }
  const pad = (hi - lo) * 0.12
  return { min: lo - pad, max: hi + pad }
}

function pct(value: number, min: number, max: number): number {
  if (max <= min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

function formatVal(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 100) return String(Math.round(n * 10) / 10)
  if (Math.abs(n) >= 10) return String(Math.round(n * 10) / 10)
  return String(Math.round(n * 100) / 100)
}

function deltaLabel(d: number | null): string {
  if (d == null || !Number.isFinite(d)) return ''
  const sign = d > 0 ? '↑' : d < 0 ? '↓' : '→'
  return `${sign}${Math.abs(d)}%`
}

export default function BloodworkChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<ChartPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/bloodwork/chart')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load chart')
        setData(d)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load chart'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const groups = useMemo(() => {
    if (!data?.series.length) return [] as Array<{ name: string; rows: ChartSeries[] }>
    const order: string[] = []
    const map = new Map<string, ChartSeries[]>()
    for (const s of data.series) {
      if (!map.has(s.group)) {
        order.push(s.group)
        map.set(s.group, [])
      }
      map.get(s.group)!.push(s)
    }
    return order.map(name => ({ name, rows: map.get(name)! }))
  }, [data])

  const priorDate = data?.panels.length
    ? [...data.panels].sort((a, b) => a.drawDate.localeCompare(b.drawDate))[0]?.drawDate
    : null
  const latestDate = data?.panels[0]?.drawDate ?? null

  if (loading) {
    return <div className="h-64 rounded-2xl bg-pens-surface/30 animate-pulse" />
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-pens-surface/30 p-5 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="rounded-2xl border border-pens-muted/25 bg-pens-surface/30 p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-rose-300/90 mb-2">Blood chart</h2>
        <p className="text-sm text-pens-cream/50">
          Need at least one panel with numeric markers. Add a draw below or via photo.
        </p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-rose-500/25 bg-pens-surface/30 p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-300/90">Blood chart</h2>
          <p className="text-sm text-pens-cream/55 mt-1 max-w-xl">
            Marker position inside the listed lab reference band
            {priorDate && latestDate && priorDate !== latestDate
              ? ` · ${priorDate} → ${latestDate}`
              : latestDate
                ? ` · latest ${latestDate}`
                : ''}
            .
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-pens-cream/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Prior
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Latest
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-6 h-2 rounded-sm bg-emerald-500/35 border border-emerald-400/40" /> Ref
          </span>
        </div>
      </div>

      <div className="space-y-8">
        {groups.map(g => (
          <div key={g.name}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-pens-cream/40 mb-3">
              {g.name}
            </h3>
            <ul className="space-y-4">
              {g.rows.map(s => {
                const { min, max } = scaleBounds(s)
                const refLeft =
                  s.refLow != null ? pct(s.refLow, min, max) : s.refHigh != null ? 0 : null
                const refRight =
                  s.refHigh != null
                    ? pct(s.refHigh, min, max)
                    : s.refLow != null
                      ? 100
                      : null
                const priorPt = s.points.length >= 2 ? s.points[s.points.length - 2] : null
                const latestPt = s.points[s.points.length - 1] ?? null
                const chip = FLAG_CHIP[s.latestFlag]

                return (
                  <li key={s.code} className="grid grid-cols-1 md:grid-cols-[11rem_1fr_7.5rem] gap-2 md:gap-4 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-pens-cream truncate">{s.label}</p>
                      <p className="text-[10px] text-pens-cream/40 tabular-nums">
                        {s.unit ?? '—'}
                        {s.refLow != null || s.refHigh != null
                          ? ` · ref ${s.refLow ?? '…'}–${s.refHigh ?? '…'}`
                          : ''}
                      </p>
                    </div>

                    <div className="relative h-8 rounded-lg bg-pens-deep/80 border border-pens-muted/20 overflow-hidden">
                      {refLeft != null && refRight != null && (
                        <div
                          className="absolute top-1 bottom-1 rounded-sm bg-emerald-500/25 border border-emerald-400/30"
                          style={{ left: `${refLeft}%`, width: `${Math.max(2, refRight - refLeft)}%` }}
                        />
                      )}
                      {priorPt && latestPt && priorPt.drawDate !== latestPt.drawDate && (
                        <div
                          className="absolute top-1/2 h-px bg-pens-cream/25"
                          style={{
                            left: `${Math.min(pct(priorPt.value, min, max), pct(latestPt.value, min, max))}%`,
                            width: `${Math.abs(pct(latestPt.value, min, max) - pct(priorPt.value, min, max))}%`,
                          }}
                        />
                      )}
                      {priorPt && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-sky-400 border-2 border-pens-deep shadow"
                          style={{ left: `${pct(priorPt.value, min, max)}%` }}
                          title={`${priorPt.drawDate}: ${priorPt.value}`}
                        />
                      )}
                      {latestPt && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-pens-deep shadow"
                          style={{ left: `${pct(latestPt.value, min, max)}%` }}
                          title={`${latestPt.drawDate}: ${latestPt.value}`}
                        />
                      )}
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
                      <div className="text-right tabular-nums">
                        <p className="text-sm font-semibold text-pens-cream">
                          {formatVal(s.latest)}
                          {s.unit ? <span className="text-[10px] text-pens-cream/40 ml-1">{s.unit}</span> : null}
                        </p>
                        {s.deltaPct != null && (
                          <p
                            className={`text-[10px] ${
                              s.deltaPct < 0
                                ? 'text-emerald-300/80'
                                : s.deltaPct > 0
                                  ? 'text-amber-200/80'
                                  : 'text-pens-cream/40'
                            }`}
                          >
                            {priorPt ? `${formatVal(priorPt.value)} → ` : ''}
                            {deltaLabel(s.deltaPct)}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${chip.className}`}>
                        {chip.label}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {latestDate && (
        <p className="text-xs text-pens-cream/45">
          Open latest panel:{' '}
          <Link href={`/bloodwork/${data.panels[0]!.id}`} className="text-rose-300 hover:text-rose-200 underline-offset-2 hover:underline">
            {data.panels[0]!.drawDate}
            {data.panels[0]!.labName ? ` · ${data.panels[0]!.labName}` : ''}
          </Link>
        </p>
      )}
      <p className="text-[10px] text-pens-cream/35 leading-relaxed">{data.disclaimer}</p>
    </section>
  )
}
