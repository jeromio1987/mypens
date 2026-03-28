'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Trash2 } from 'lucide-react'

interface SleepEntry {
  id: string
  date: string
  bedtime: string
  wakeTime: string
  hours: number
  quality: number
  hrv?: number
  notes?: string
}

interface ChartEntry extends SleepEntry {
  label: string
  qualityLine: number
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
}

const qualityColor = (q: number) => {
  if (q >= 5) return '#7c3aed'
  if (q >= 4) return '#8b5cf6'
  if (q >= 3) return '#a78bfa'
  if (q >= 2) return '#c4b5fd'
  return '#e5e7eb'
}

export default function SleepTrend({ refresh }: { refresh?: number }) {
  const [data, setData] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/sleep')
      .then(r => r.json())
      .then((entries: SleepEntry[]) => {
        const sorted = [...entries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30)
          .map(e => ({
            ...e,
            label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            }),
            qualityLine: e.quality,
          }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refresh])

  const handleDelete = async (id: string) => {
    await fetch('/api/sleep', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  if (loading)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">Loading chart…</div>

  if (data.length === 0)
    return <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">No sleep entries yet — log your first night above.</div>

  const avgHours = (data.reduce((s, e) => s + e.hours, 0) / data.length).toFixed(1)
  const avgQuality = (data.reduce((s, e) => s + e.quality, 0) / data.length).toFixed(1)

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">30-Day Sleep Trend</h2>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Avg <strong className="text-violet-600">{avgHours}h</strong></span>
          <span>Quality <strong className="text-violet-600">{avgQuality}/5</strong></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis
            yAxisId="hours"
            domain={[0, 12]}
            tick={{ fontSize: 11 }}
            unit="h"
            width={36}
          />
          <YAxis
            yAxisId="quality"
            orientation="right"
            domain={[0, 5]}
            tick={{ fontSize: 11 }}
            width={28}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'hours') return [`${value}h`, 'Sleep duration']
              if (name === 'qualityLine') return [`${value}/5`, 'Quality']
              return [value, name]
            }}
          />
          <Legend
            formatter={(v) => (v === 'hours' ? 'Duration' : v === 'qualityLine' ? 'Quality (right axis)' : v)}
          />
          <Bar yAxisId="hours" dataKey="hours" radius={[4, 4, 0, 0]} name="hours">
            {data.map((entry, i) => (
              <Cell key={i} fill={qualityColor(entry.quality)} />
            ))}
          </Bar>
          <Line
            yAxisId="quality"
            type="monotone"
            dataKey="qualityLine"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="qualityLine"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* History table */}
      <div className="mt-5">
        <h3 className="text-sm font-medium text-gray-600 mb-2">History</h3>
        <div className="space-y-px max-h-56 overflow-y-auto">
          {[...data].reverse().map(e => (
            <div
              key={e.id}
              className="flex items-center gap-2 text-sm py-2 px-2 rounded-lg hover:bg-gray-50 group"
            >
              <span className="text-gray-400 w-16 shrink-0">{e.label}</span>
              <span className="font-medium w-12">{e.hours}h</span>
              <span className="text-violet-600 w-6 text-center font-medium">{e.quality}★</span>
              <span className="text-gray-400 text-xs">{e.bedtime} → {e.wakeTime}</span>
              {e.hrv && <span className="text-teal-500 text-xs ml-1">HRV {e.hrv}ms</span>}
              {e.notes && <span className="text-gray-400 text-xs truncate max-w-[120px]">{e.notes}</span>}
              <button
                onClick={() => handleDelete(e.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
