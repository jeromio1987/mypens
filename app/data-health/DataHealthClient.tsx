'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Scale, UtensilsCrossed, Moon, Dumbbell, Ruler, Flame, Trophy } from 'lucide-react'

interface StreakModule {
  current: number
  longest: number
  lastLogged: string | null
  coverage: number
}
interface StreaksData {
  weight:       StreakModule
  food:         StreakModule
  sleep:        StreakModule
  training:     StreakModule
  measurements: StreakModule
}

interface DayData {
  date: string
  weight: boolean
  food: boolean
  sleep: boolean
  training: boolean
  measurements: boolean
}

const MODULES = [
  { key: 'weight',       label: 'Weight',       icon: Scale,          color: '#3b82f6', bg: 'bg-blue-500' },
  { key: 'food',         label: 'Food',         icon: UtensilsCrossed,color: '#10b981', bg: 'bg-emerald-500' },
  { key: 'sleep',        label: 'Sleep',        icon: Moon,           color: '#7c3aed', bg: 'bg-violet-600' },
  { key: 'training',     label: 'Training',     icon: Dumbbell,       color: '#f97316', bg: 'bg-orange-500' },
  { key: 'measurements', label: 'Measurements', icon: Ruler,          color: '#f43f5e', bg: 'bg-rose-500' },
] as const

type ModuleKey = typeof MODULES[number]['key']

function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
}

export default function DataHealthClient() {
  const [streaks, setStreaks]   = useState<StreaksData | null>(null)
  const [calendar, setCalendar] = useState<DayData[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const days = last30Days()
    Promise.all([
      fetch('/api/streaks').then(r => r.json()),
      fetch('/api/weight').then(r => r.json()),
      fetch('/api/food').then(r => r.json()),
      fetch('/api/sleep').then(r => r.json()),
      fetch('/api/training').then(r => r.json()),
      fetch('/api/measurements').then(r => r.json()),
    ]).then(([s, w, f, sl, tr, me]) => {
      setStreaks(s)
      const wSet  = new Set((w  as { date: string }[]).map(x => x.date))
      const fSet  = new Set((f  as { date: string }[]).map(x => x.date))
      const slSet = new Set((sl as { date: string }[]).map(x => x.date))
      const trSet = new Set((tr as { date: string }[]).map(x => x.date))
      const meSet = new Set((me as { date: string }[]).map(x => x.date))
      setCalendar(days.map(date => ({
        date,
        weight:       wSet.has(date),
        food:         fSet.has(date),
        sleep:        slSet.has(date),
        training:     trSet.has(date),
        measurements: meSet.has(date),
      })))
    }).finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto text-center py-12 text-gray-400 text-sm">Loading…</div>
      </main>
    )

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Health</h1>
            <p className="text-sm text-gray-400 mt-0.5">30-day logging coverage &amp; streaks</p>
          </div>
        </div>

        {/* Streaks grid */}
        {streaks && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Flame size={16} className="text-orange-500" />
              Current Streaks
            </h2>
            <div className="space-y-3">
              {MODULES.map(({ key, label, icon: Icon, color, bg }) => {
                const s = streaks[key as ModuleKey]
                const pct = s.coverage
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">{pct}% / 30d</span>
                          {s.current > 0 ? (
                            <span className="font-semibold text-orange-500 flex items-center gap-0.5">
                              <Flame size={11} />{s.current}d
                            </span>
                          ) : (
                            <span className="text-gray-300">no streak</span>
                          )}
                          {s.longest > 1 && s.longest !== s.current && (
                            <span className="text-gray-400 flex items-center gap-0.5">
                              <Trophy size={10} />{s.longest}d best
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${bg}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 30-day calendar heatmap */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-1">30-Day Calendar</h2>
          <p className="text-xs text-gray-400 mb-4">Each row = one module · Filled = logged that day</p>

          {/* Module legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            {MODULES.map(({ key, label, color }) => (
              <span key={key} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>

          {/* Date labels — every 5 days */}
          <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `repeat(30, minmax(0, 1fr))` }}>
            {calendar.map((d, i) => (
              <div key={d.date} className="text-center">
                {i % 5 === 0 ? (
                  <span className="text-[9px] text-gray-400">{d.date.slice(8)}</span>
                ) : null}
              </div>
            ))}
          </div>

          {/* Heat rows */}
          {MODULES.map(({ key, color }) => (
            <div key={key} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: `repeat(30, minmax(0, 1fr))` }}>
              {calendar.map(d => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d[key as ModuleKey] ? 'logged' : 'missing'}`}
                  className="h-5 rounded-sm"
                  style={{ backgroundColor: d[key as ModuleKey] ? color : '#f3f4f6' }}
                />
              ))}
            </div>
          ))}

          {/* Month label */}
          <p className="text-xs text-gray-400 mt-2 text-right">
            {calendar.length > 0 && `${calendar[0].date} → ${calendar[calendar.length - 1].date}`}
          </p>
        </div>

        {/* Coverage table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Coverage Summary</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {streaks && MODULES.map(({ key, label, icon: Icon, color }) => {
              const s = streaks[key as ModuleKey]
              const daysLogged = Math.round(s.coverage * 30 / 100)
              return (
                <div key={key} className="px-5 py-3 flex items-center gap-3">
                  <Icon size={15} style={{ color }} className="shrink-0" />
                  <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                  <span className="text-sm font-bold text-gray-900">{daysLogged}/30</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{s.coverage}%</span>
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.coverage}%`, backgroundColor: color }}
                    />
                  </div>
                  {s.lastLogged && (
                    <span className="text-xs text-gray-400 w-20 text-right shrink-0">
                      last: {s.lastLogged.slice(5)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to home</Link>
        </div>
      </div>
    </main>
  )
}
