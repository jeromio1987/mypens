'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

interface GarminActivity {
  id: string
  date: string
  name: string
  sport: string
  subSport?: string
  durationSec: number
  distanceM?: number
  elevationM?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  avgSpeedMs?: number
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtDistance(m?: number): string {
  if (!m) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function fmtPace(distM?: number, durationSec?: number): string {
  if (!distM || !durationSec || distM < 100) return '—'
  const secPerKm = (durationSec / distM) * 1000
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')} /km`
}

function fmtSpeed(ms?: number): string {
  if (!ms) return '—'
  return `${(ms * 3.6).toFixed(1)} km/h`
}

function sportIcon(sport: string): string {
  const icons: Record<string, string> = {
    running:           '🏃',
    cycling:           '🚴',
    walking:           '🚶',
    swimming:          '🏊',
    hiking:            '🥾',
    strength_training: '🏋️',
    cardio_training:   '❤️',
    yoga:              '🧘',
    indoor_cycling:    '🚴',
    transition:        '🔄',
    generic:           '⚡',
  }
  return icons[sport] ?? '⚡'
}

function sportLabel(sport: string): string {
  return sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Weekly distance chart data ─────────────────────────────────────────────────

function weeklyDistanceData(activities: GarminActivity[]) {
  const map = new Map<string, number>()
  for (const a of activities) {
    if (!a.distanceM) continue
    const d = new Date(a.date + 'T00:00:00')
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    map.set(key, (map.get(key) ?? 0) + a.distanceM / 1000)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, km]) => ({ week, km: parseFloat(km.toFixed(1)) }))
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  year: string
  sport: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GarminLog({ year, sport }: Props) {
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (year !== 'all') params.set('year', year)
    if (sport !== 'all') params.set('sport', sport)
    params.set('limit', '1000')

    fetch(`/api/garmin?${params}`)
      .then(r => r.json())
      .then(data => { setActivities(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, sport])

  if (loading)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading…</div>

  if (activities.length === 0)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        No activities found for this filter.
      </div>
    )

  // Summary stats
  const totalActivities = activities.length
  const totalDistKm     = activities.reduce((s, a) => s + (a.distanceM ?? 0), 0) / 1000
  const totalTimeSec    = activities.reduce((s, a) => s + a.durationSec, 0)
  const totalCalories   = activities.reduce((s, a) => s + (a.calories ?? 0), 0)
  const avgHrAll        = activities.filter(a => a.avgHr).map(a => a.avgHr!)
  const avgHrMean       = avgHrAll.length
    ? Math.round(avgHrAll.reduce((s, v) => s + v, 0) / avgHrAll.length)
    : null

  const weekly = weeklyDistanceData(activities)

  return (
    <div className="space-y-6">

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activities',    value: totalActivities.toString() },
          { label: 'Total distance', value: totalDistKm > 0 ? `${totalDistKm.toFixed(0)} km` : '—' },
          { label: 'Total time',    value: fmtDuration(totalTimeSec) },
          { label: 'Avg HR',        value: avgHrMean ? `${avgHrMean} bpm` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl shadow p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Weekly distance chart (only if there's distance data) */}
      {weekly.length > 1 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Weekly Distance (km)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" km" width={48} />
              <Tooltip formatter={(v: number) => [`${v} km`, 'Distance']} />
              <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                {weekly.map((_, i) => (
                  <Cell key={i} fill={i === weekly.length - 1 ? '#0d9488' : '#99f6e4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Activity list */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Activities
          <span className="ml-2 text-sm font-normal text-gray-400">{totalActivities} total</span>
        </h2>
        <div className="space-y-px max-h-[600px] overflow-y-auto">
          {activities.map(a => {
            const isCardio = !!a.distanceM && a.distanceM > 100
            const isRunning = a.sport === 'running' || a.sport === 'walking' || a.sport === 'hiking'
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 text-sm group"
              >
                {/* Icon */}
                <span className="text-lg w-7 text-center flex-shrink-0" title={sportLabel(a.sport)}>
                  {sportIcon(a.sport)}
                </span>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {a.subSport ? ` · ${a.subSport}` : ''}
                  </p>
                </div>

                {/* Distance */}
                <span className="text-gray-600 text-xs w-20 text-right flex-shrink-0">
                  {fmtDistance(a.distanceM)}
                </span>

                {/* Pace or speed */}
                <span className="text-gray-400 text-xs w-24 text-right hidden sm:block flex-shrink-0">
                  {isRunning && isCardio
                    ? fmtPace(a.distanceM, a.durationSec)
                    : isCardio
                    ? fmtSpeed(a.avgSpeedMs)
                    : '—'}
                </span>

                {/* Duration */}
                <span className="text-teal-600 text-xs font-medium w-16 text-right flex-shrink-0">
                  {fmtDuration(a.durationSec)}
                </span>

                {/* HR */}
                {a.avgHr ? (
                  <span className="text-red-400 text-xs w-16 text-right flex-shrink-0">
                    ♥ {a.avgHr}
                  </span>
                ) : (
                  <span className="w-16 flex-shrink-0" />
                )}

                {/* Calories */}
                {a.calories ? (
                  <span className="text-orange-400 text-xs w-16 text-right hidden sm:block flex-shrink-0">
                    {a.calories} kcal
                  </span>
                ) : (
                  <span className="w-16 hidden sm:block flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
