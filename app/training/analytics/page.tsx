'use client'

import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type TrainingRow = { date: string; volume: number; rpe: number | null }
type SleepRow = { date: string; quality: number; hours: number }

export default function TrainingAnalyticsPage() {
  const [training, setTraining] = useState<TrainingRow[]>([])
  const [sleep, setSleep] = useState<SleepRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [rt, rs] = await Promise.all([fetch('/api/training'), fetch('/api/sleep')])
        const [tj, sj] = await Promise.all([rt.json(), rs.json()])
        if (!cancelled) {
          if (Array.isArray(tj)) setTraining(tj)
          if (Array.isArray(sj)) setSleep(sj)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const weekly = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of training) {
      const wk = t.date.slice(0, 7)
      map.set(wk, (map.get(wk) ?? 0) + (t.volume || 0))
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8)
  }, [training])

  const avgSleepQuality = useMemo(() => {
    const recent = sleep.slice(0, 10)
    if (!recent.length) return null
    return recent.reduce((s, x) => s + x.quality, 0) / recent.length
  }, [sleep])

  const lastWeekVol = weekly.length ? weekly[weekly.length - 1][1] : 0
  const prevWeekVol = weekly.length > 1 ? weekly[weekly.length - 2][1] : 0
  const volJump = prevWeekVol > 0 ? (lastWeekVol - prevWeekVol) / prevWeekVol : 0

  const deloadHint =
    volJump > 0.25 && (avgSleepQuality ?? 4) < 3.2
      ? 'Volume climbed while sleep quality dipped — consider a deload or one fewer hard session this week.'
      : volJump > 0.35
        ? 'Volume ramp is steep — watch joint stress and keep one easy day.'
        : 'Load progression looks sustainable relative to recent sleep.'

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8 text-pens-cream">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/training" className="text-pens-cream/40 hover:text-pens-cream/70">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">Training</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 size={22} className="text-orange-400" />
              Volume & recovery
            </h1>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-pens-cream/40">Loading…</p>
        ) : (
          <>
            <div className="rounded-2xl border border-pens-muted/25 bg-pens-navy/50 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">Weekly volume (kg·reps)</p>
              <div className="flex items-end gap-1 h-28">
                {weekly.map(([wk, vol]) => {
                  const max = Math.max(...weekly.map(([, v]) => v), 1)
                  const h = Math.round((vol / max) * 100)
                  return (
                    <div key={wk} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-orange-500/70"
                        style={{ height: `${Math.max(8, h)}%` }}
                        title={`${wk}: ${vol.toFixed(0)}`}
                      />
                      <span className="text-[9px] text-pens-cream/35 -rotate-45 origin-top">{wk.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-pens-muted/25 bg-pens-navy/50 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">Deload heuristic</p>
              <p className="text-sm text-pens-cream/75 leading-relaxed">{deloadHint}</p>
              {avgSleepQuality != null && (
                <p className="text-xs text-pens-cream/45">Recent sleep quality (last 10 logs): {avgSleepQuality.toFixed(2)} / 5</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
