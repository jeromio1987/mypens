'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'

interface TrainingEntry {
  id: string
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe?: number
  notes?: string
  volume: number
}

interface SessionGroup {
  date: string
  label: string
  entries: TrainingEntry[]
  totalVolume: number
}

interface WeeklyBar {
  week: string
  volume: number
}

interface Props {
  date: string
  refresh: number
}

function groupByDate(entries: TrainingEntry[]): SessionGroup[] {
  const map = new Map<string, TrainingEntry[]>()
  for (const e of entries) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, es]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      entries: es,
      totalVolume: parseFloat(es.reduce((s, e) => s + e.volume, 0).toFixed(0)),
    }))
}

function weeklyVolume(entries: TrainingEntry[]): WeeklyBar[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date + 'T00:00:00')
    // ISO week Monday
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    const weekKey = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    map.set(weekKey, (map.get(weekKey) || 0) + e.volume)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, volume]) => ({ week, volume: parseFloat(volume.toFixed(0)) }))
}

export default function TrainingLog({ date, refresh }: Props) {
  const [allEntries, setAllEntries] = useState<TrainingEntry[]>([])
  const [todayEntries, setTodayEntries] = useState<TrainingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/training').then(r => r.json()),
      fetch(`/api/training?date=${date}`).then(r => r.json()),
    ]).then(([all, today]) => {
      setAllEntries(all)
      setTodayEntries(today)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refresh, date])

  const handleDelete = async (id: string) => {
    await fetch('/api/training', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  if (loading)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading…</div>

  const sessions = groupByDate(allEntries)
  const weekly = weeklyVolume(allEntries)
  const todayVolume = todayEntries.reduce((s, e) => s + e.volume, 0).toFixed(0)

  return (
    <div className="space-y-6">
      {/* Today's session */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Today's Session</h2>
          {todayEntries.length > 0 && (
            <span className="text-sm text-orange-500 font-medium">
              Total volume: {parseFloat(todayVolume) > 0 ? `${todayVolume} kg` : 'bodyweight'}
            </span>
          )}
        </div>

        {todayEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No exercises logged for this date.</p>
        ) : (
          <div className="space-y-px">
            {todayEntries.map(e => (
              <div
                key={e.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 group text-sm"
              >
                <span className="font-medium flex-1">{e.exercise}</span>
                <span className="text-gray-500 text-xs">
                  {e.sets}×{e.reps}
                  {e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}
                </span>
                {e.rpe && (
                  <span className="text-xs text-gray-400">RPE {e.rpe}</span>
                )}
                {e.volume > 0 && (
                  <span className="text-orange-500 text-xs font-medium w-20 text-right">
                    {e.volume} kg
                  </span>
                )}
                {e.notes && (
                  <span className="text-gray-400 text-xs truncate max-w-[100px]">{e.notes}</span>
                )}
                <button
                  onClick={() => handleDelete(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly volume chart */}
      {weekly.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Weekly Volume (kg)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" kg" width={56} />
              <Tooltip formatter={(v) => [`${v} kg`, 'Volume']} />
              <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                {weekly.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === weekly.length - 1 ? '#f97316' : '#fed7aa'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Session history */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {sessions.slice(0, 14).map(s => (
              <div key={s.date}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  {s.totalVolume > 0 && (
                    <span className="text-xs text-orange-500">{s.totalVolume} kg total</span>
                  )}
                </div>
                <div className="space-y-px pl-2 border-l-2 border-orange-100">
                  {s.entries.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
                      <span className="font-medium text-gray-700">{e.exercise}</span>
                      <span>{e.sets}×{e.reps}{e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}</span>
                      {e.rpe && <span className="text-gray-400">RPE {e.rpe}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
