'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TrainingEntry, { type ProgrammeExerciseQueueItem } from '@/components/training/TrainingEntry'
import TrainingLog from '@/components/training/TrainingLog'
import EnergyBalanceCard from '@/components/food/EnergyBalanceCard'
import WeekEnergyRecapCard from '@/components/food/WeekEnergyRecapCard'
import { today } from '@/lib/timeWindow'

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
    <div className="bg-ct-high overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ct-highest transition-colors"
      >
        <span className="font-grotesk text-[0.65rem] uppercase tracking-[0.16em] text-ct-primary">Exercises</span>
        {open ? (
          <ChevronDown size={18} className="text-ct-second/50 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-ct-second/50 shrink-0" />
        )}
      </button>
      {open && (
        <div className="bg-ct-highest/50 px-4 py-3 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-ct-second/40 py-4 text-center animate-pulse">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-ct-second/45 py-3">No exercises logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map(r => (
                <li key={r.exercise} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 bg-ct-high/40 px-2">
                  <Link
                    href={`/training/exercise/${encodeURIComponent(r.exercise)}`}
                    className="font-medium text-ct-blood hover:underline truncate min-w-0 flex-1 basis-[40%]"
                  >
                    {r.exercise}
                  </Link>
                  <span className="text-ct-second/50 text-xs tabular-nums">{r.sessionCount} sessions</span>
                  <span className="text-ct-second/40 text-xs">
                    {r.lastDate
                      ? new Date(r.lastDate + 'T00:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })
                      : '—'}
                  </span>
                  <span className="text-ct-primary/90 text-xs font-medium tabular-nums ml-auto">PB {r.personalBestKg} kg</span>
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
  const todayStr = today()
  const [date, setDate] = useState(todayStr)
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
    <div className="px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-grotesk text-[0.625rem] uppercase tracking-[0.18em] text-ct-second/55">Train</p>
            <h1 className="mt-2 font-headline text-3xl uppercase leading-none tracking-[0.06em] text-ct-primary">
              Sessions
            </h1>
            <p className="mt-2 font-grotesk text-[0.7rem] text-ct-second/55">Sets · Reps · Volume</p>
          </div>
          <div className="flex flex-wrap items-stretch gap-0">
            <Link
              href="/training/activity-stream"
              className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-second/60 hover:text-ct-primary bg-ct-high px-3 py-2.5"
            >
              Feed
            </Link>
            <Link
              href="/training/analytics"
              className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-second/60 hover:text-ct-primary bg-ct-high px-3 py-2.5"
            >
              Analytics
            </Link>
            <Link
              href="/programmes/compare"
              className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-second/60 hover:text-ct-primary bg-ct-highest px-3 py-2.5"
            >
              Compare
            </Link>
            <Link
              href="/programmes"
              className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-blood bg-ct-bloodc px-3 py-2.5"
            >
              Programmes
            </Link>
            <Link
              href="/integrations"
              className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-second/60 hover:text-ct-primary bg-ct-high px-3 py-2.5"
              title="Health Connect, Garmin, Strava"
            >
              Sync
            </Link>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-ct-highest px-3 py-2 text-sm text-ct-primary font-grotesk focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        {activeProgramme && (
          <div className="bg-ct-highest px-4 py-3">
            <label className="block font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-second/55 mb-1.5">
              Start from programme
            </label>
            <select
              value={dayPick}
              onChange={e => startFromDay(e.target.value)}
              className="w-full bg-ct-low px-3 py-2 text-sm text-ct-primary"
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
        <WeekEnergyRecapCard asOf={date} refresh={refresh} compact />
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
    </div>
  )
}
