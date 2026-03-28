'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface Entry {
  id: string
  date: string
  scaleKg: number
  trueWeightKg: number
  bodyFatPct?: number
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  tanitaReliable: boolean
}

interface ChartEntry extends Entry {
  label: string
  retention: number
}

export default function WeightTrend({ refresh }: { refresh?: number }) {
  const [data, setData] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/weight')
      .then(r => r.json())
      .then((entries: Entry[]) => {
        const sorted = [...entries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(e => ({
            ...e,
            label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            }),
            retention: parseFloat((e.scaleKg - e.trueWeightKg).toFixed(2)),
          }))
        setData(sorted)
      })
      .finally(() => setLoading(false))
  }, [refresh])

  if (loading)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        Loading chart…
      </div>
    )

  if (data.length === 0)
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
        No entries yet — log your first weight above.
      </div>
    )

  return (
    <div className="bg-white rounded-2xl shadow p-6 w-full">
      <h2 className="text-xl font-semibold mb-4">30-Day Trend</h2>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit=" kg" width={52} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                scaleKg: 'Scale',
                trueWeightKg: 'True weight',
                retention: 'Water retention',
              }
              return [`${value} kg`, labels[name] ?? name]
            }}
          />
          <Legend
            formatter={(v: string) => {
              const labels: Record<string, string> = {
                scaleKg: 'Scale weight',
                trueWeightKg: 'True weight',
                retention: 'Retention',
              }
              return labels[v] ?? v
            }}
          />
          <Line
            type="monotone"
            dataKey="scaleKg"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="trueWeightKg"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="retention"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Entry history */}
      <div className="mt-5">
        <h3 className="text-sm font-medium text-gray-600 mb-2">History</h3>
        <div className="space-y-px max-h-52 overflow-y-auto">
          {[...data].reverse().map(e => (
            <div
              key={e.id}
              className="flex items-center justify-between text-sm py-2 px-2 rounded-lg hover:bg-gray-50"
            >
              <span className="text-gray-400 w-16 shrink-0">{e.label}</span>
              <span className="font-medium">{e.scaleKg} kg</span>
              <span className="text-emerald-600 font-medium">→ {e.trueWeightKg} kg</span>
              <span className="text-amber-500 text-xs w-14 text-right">
                {e.retention > 0 ? `+${e.retention} kg` : ''}
              </span>
              <span className="text-gray-300 text-xs w-12 text-right">
                {e.bodyFatPct ? `${e.bodyFatPct}%` : ''}
              </span>
              {!e.tanitaReliable && (
                <span className="text-amber-400 text-xs ml-1" title="Tanita reading unreliable">
                  ⚠
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
