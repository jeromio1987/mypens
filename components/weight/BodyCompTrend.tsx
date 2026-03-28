'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

interface WeightEntry {
  id: string
  date: string
  bodyFatPct: number | null
  muscleMassKg: number | null
  tanitaReliable: boolean
}

interface ChartPoint {
  label: string
  bodyFatPct: number | null
  muscleMassKg: number | null
  reliable: boolean
}

export default function BodyCompTrend({ refresh }: { refresh?: number }) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showUnreliable, setShowUnreliable] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/weight')
      .then(r => r.json())
      .then((entries: WeightEntry[]) => {
        const sorted = [...entries]
          .filter(e => e.bodyFatPct != null || e.muscleMassKg != null)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(e => ({
            label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            }),
            bodyFatPct: e.bodyFatPct,
            muscleMassKg: e.muscleMassKg,
            reliable: e.tanitaReliable,
          }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }, [refresh])

  if (loading)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        Loading body comp…
      </div>
    )

  if (data.length === 0)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        No Tanita data yet — log body fat % or muscle mass in a weight entry.
      </div>
    )

  const filtered = showUnreliable ? data : data.filter(d => d.reliable)

  // Latest stats
  const latest = [...filtered].reverse().find(d => d.bodyFatPct != null || d.muscleMassKg != null)
  const fatEntries = filtered.filter(d => d.bodyFatPct != null)
  const muscleEntries = filtered.filter(d => d.muscleMassKg != null)
  const avgFat = fatEntries.length
    ? (fatEntries.reduce((s, d) => s + (d.bodyFatPct ?? 0), 0) / fatEntries.length).toFixed(1)
    : null
  const avgMuscle = muscleEntries.length
    ? (muscleEntries.reduce((s, d) => s + (d.muscleMassKg ?? 0), 0) / muscleEntries.length).toFixed(1)
    : null

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Body Composition Trend</h2>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {avgFat && <span>Avg fat <strong className="text-rose-500">{avgFat}%</strong></span>}
          {avgMuscle && <span>Avg muscle <strong className="text-emerald-600">{avgMuscle} kg</strong></span>}
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreliable}
              onChange={e => setShowUnreliable(e.target.checked)}
              className="accent-amber-500"
            />
            Include ⚠ readings
          </label>
        </div>
      </div>

      {filtered.length < 2 ? (
        <p className="text-sm text-gray-400">
          {showUnreliable
            ? 'Need at least 2 data points to draw a trend.'
            : 'All readings flagged as unreliable. Enable "Include ⚠ readings" to see them.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              yAxisId="fat"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11 }}
              unit="%"
              width={38}
              label={{ value: 'Fat %', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 10, fill: '#f43f5e' } }}
            />
            <YAxis
              yAxisId="muscle"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11 }}
              unit=" kg"
              width={44}
              label={{ value: 'Muscle', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#10b981' } }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'bodyFatPct') return [`${value}%`, 'Body fat']
                if (name === 'muscleMassKg') return [`${value} kg`, 'Muscle mass']
                return [value, name]
              }}
            />
            <Legend
              formatter={(v) =>
                v === 'bodyFatPct' ? 'Body fat %' : v === 'muscleMassKg' ? 'Muscle mass (kg)' : v
              }
            />
            <Line
              yAxisId="fat"
              type="monotone"
              dataKey="bodyFatPct"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="muscle"
              type="monotone"
              dataKey="muscleMassKg"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Latest reading summary */}
      {latest && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
          {latest.bodyFatPct != null && (
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-xs font-medium text-rose-400 mb-0.5">Body fat</p>
              <p className="text-2xl font-bold text-rose-600">{latest.bodyFatPct}%</p>
            </div>
          )}
          {latest.muscleMassKg != null && (
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-medium text-emerald-500 mb-0.5">Muscle mass</p>
              <p className="text-2xl font-bold text-emerald-600">{latest.muscleMassKg} kg</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
