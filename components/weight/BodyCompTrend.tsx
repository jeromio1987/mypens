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
    return <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 text-sm text-pens-cream/40">Loading body comp…</div>

  if (data.length === 0)
    return <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 text-sm text-pens-cream/40">No Tanita data yet — log body fat % or muscle mass in a weight entry.</div>

  const filtered = showUnreliable ? data : data.filter(d => d.reliable)

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
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 w-full space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-pens-cream">Body Composition Trend</h2>
        <div className="flex items-center gap-3 text-sm text-pens-cream/50">
          {avgFat && <span>Avg fat <strong className="text-rose-400">{avgFat}%</strong></span>}
          {avgMuscle && <span>Avg muscle <strong className="text-emerald-400">{avgMuscle} kg</strong></span>}
          <label className="flex items-center gap-1.5 text-xs text-pens-cream/40 cursor-pointer">
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
        <p className="text-sm text-pens-cream/40">
          {showUnreliable
            ? 'Need at least 2 data points to draw a trend.'
            : 'All readings flagged as unreliable. Enable "Include ⚠ readings" to see them.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3D405B50" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#F5E6D360' }} />
            <YAxis
              yAxisId="fat"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#F5E6D360' }}
              unit="%"
              width={38}
              label={{ value: 'Fat %', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 10, fill: '#f43f5e' } }}
            />
            <YAxis
              yAxisId="muscle"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#F5E6D360' }}
              unit=" kg"
              width={44}
              label={{ value: 'Muscle', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#10b981' } }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#2B2D42', border: '1px solid #3D405B80', borderRadius: '8px', color: '#F5E6D3' }}
              formatter={(value, name) => {
                if (name === 'bodyFatPct') return [`${value}%`, 'Body fat']
                if (name === 'muscleMassKg') return [`${value} kg`, 'Muscle mass']
                return [value, name]
              }}
            />
            <Legend
              wrapperStyle={{ color: '#F5E6D380', fontSize: '11px' }}
              formatter={(v) =>
                v === 'bodyFatPct' ? 'Body fat %' : v === 'muscleMassKg' ? 'Muscle mass (kg)' : v
              }
            />
            <Line yAxisId="fat" type="monotone" dataKey="bodyFatPct" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="muscle" type="monotone" dataKey="muscleMassKg" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {latest && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-pens-muted/20">
          {latest.bodyFatPct != null && (
            <div className="bg-rose-900/20 border border-rose-500/20 rounded-xl p-3">
              <p className="text-xs font-medium text-rose-400 mb-0.5">Body fat</p>
              <p className="text-2xl font-bold text-rose-300">{latest.bodyFatPct}%</p>
            </div>
          )}
          {latest.muscleMassKg != null && (
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-xs font-medium text-emerald-400 mb-0.5">Muscle mass</p>
              <p className="text-2xl font-bold text-emerald-300">{latest.muscleMassKg} kg</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
