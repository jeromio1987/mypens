'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TrainingEntry, { type ProgrammeExerciseQueueItem } from '@/components/training/TrainingEntry'
import TrainingLog from '@/components/training/TrainingLog'
import EnergyBalanceCard from '@/components/food/EnergyBalanceCard'

interface ExerciseAggregate {
  exercise: string
  sessionCount: number
  lastDate: string
  personalBestKg: number
}

type ProgExercise = {
  id: string
  name: string
  sets: number
  reps: string
  weightKg: number | null
  order: number
}

type ProgDay = {
  id: string
  dayLabel: string
  order: number
  exercises: ProgExercise[]
}

type Programme = {
  id: string
  name: string
  active: boolean
  days: ProgDay[]
}

function ExerciseBrowserPanel() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ExerciseAggregate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      try {
        const r = await fetch('/api/training/exercise')
        const data = await r.json()
        if (!cancelled && Array.isArray(data)) setRows(data)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-pens-deep/40 transition-colors"
      >
        <span className="text-sm font-semibold text-pens-cream uppercase tracking-wide">Exercises</span>
        {open ? (
          <ChevronDown size={18} className="text-pens-gold shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-pens-gold shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-pens-muted/25 px-4 py-3 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-pens-cream/40 py-4 text-center animate-pulse">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-pens-cream/45 py-3">No exercises logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map(r => (
                <li key={r.exercise} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 border-b border-pens-muted/15 last:border-0">
                  <Link
                    href={`/training/exercise/${encodeURIComponent(r.exercise)}`}
                    className="font-medium text-pens-gold hover:underline truncate min-w-0 flex-1 basis-[40%]"
                  >
                    {r.exercise}
                  </Link>
                  <span className="text-pens-cream/50 text-xs tabular-nums">{r.sessionCount} sessions</span>
                  <span className="text-pens-cream/40 text-xs">
                    {r.lastDate
                      ? new Date(r.lastDate + 'T00:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })
                      : '—'}
                  </span>
                  <span className="text-orange-400/90 text-xs font-medium tabular-nums ml-auto">PB {r.personalBestKg} kg</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function TrainingPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [refresh, setRefresh] = useState(0)
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [dayPick, setDayPick] = useState('')
  const [queue, setQueue] = useState<ProgrammeExerciseQueueItem[]>([])

  const loadProgrammes = useCallback(() => {
    fetch('/api/programmes')
      .then(r => r.json())
      .then((rows: Programme[]) => {
        if (Array.isArray(rows)) setProgrammes(rows)
      })
      .catch(() => setProgrammes([]))
  }, [])

  useEffect(() => {
    loadProgrammes()
  }, [loadProgrammes])

  const activeProgramme = useMemo(
    () => programmes.find(p => p.active) ?? null,
    [programmes],
  )

  function startFromDay(dayId: string) {
    const day = activeProgramme?.days.find(d => d.id === dayId)
    setDayPick(dayId)
    if (!day) {
      setQueue([])
      return
    }
    const sorted = [...day.exercises].sort((a, b) => a.order - b.order)
    setQueue(
      sorted.map(e => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weightKg: e.weightKg,
      })),
    )
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs text-pens-cream/50 hover:text-pens-cream">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Training</h1>
            <p className="text-sm text-pens-cream/50">Sets · Reps · Volume</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/training/activity-stream"
              className="text-xs font-semibold text-pens-cream hover:text-white border border-pens-muted/40 rounded-lg px-2.5 py-2 transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/training/analytics"
              className="text-xs font-semibold text-pens-cream hover:text-white border border-pens-muted/40 rounded-lg px-2.5 py-2 transition-colors"
            >
              Analytics
            </Link>
            <Link
              href="/programmes/compare"
              className="text-xs font-semibold text-pens-gold/90 hover:text-pens-gold border border-pens-gold/35 rounded-lg px-2.5 py-2 transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/programmes"
              className="text-xs font-semibold text-orange-500 hover:text-orange-400 border border-orange-500/40 rounded-lg px-2.5 py-2 transition-colors"
            >
              Programmes
            </Link>
            <Link
              href="/integrations"
              className="text-xs text-pens-gold hover:text-pens-cream border border-pens-gold/40 hover:border-pens-gold/70 rounded-lg px-2.5 py-2 transition-colors"
              title="Integrations & Strava sync"
            >
              Strava ↗
            </Link>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-pens-surface border border-pens-muted/40 text-pens-cream rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pens-gold focus:border-pens-gold [color-scheme:dark]"
            />
          </div>
        </div>

        {activeProgramme && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
            <label className="block text-[10px] uppercase tracking-widest text-orange-400/90 font-bold mb-1.5">
              Start from programme
            </label>
            <select
              value={dayPick}
              onChange={e => startFromDay(e.target.value)}
              className="w-full rounded-lg border border-pens-muted/40 bg-pens-deep px-3 py-2 text-sm text-pens-cream"
            >
              <option value="">Choose day ({activeProgramme.name})…</option>
              {[...activeProgramme.days].sort((a, b) => a.order - b.order).map(d => (
                <option key={d.id} value={d.id}>
                  {d.dayLabel}
                </option>
              ))}
            </select>
          </div>
        )}

        <EnergyBalanceCard date={date} refresh={refresh} />
        <TrainingEntry
          date={date}
          programmeQueue={queue.length ? queue : undefined}
          onSaved={detail => {
            setRefresh(r => r + 1)
            if (detail?.fromProgramme) {
              setQueue(q => q.slice(1))
            }
          }}
        />
        <ExerciseBrowserPanel />
        <TrainingLog date={date} refresh={refresh} />
      </div>
    </main>
  )
}
