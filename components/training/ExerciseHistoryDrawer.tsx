'use client'

import { useEffect, useState } from 'react'
import { X, Trophy } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface TrainingEntry {
  id: string
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe?: number | null
  notes?: string | null
  volume: number
}

interface Props {
  exercise: string
  onClose: () => void
}

export default function ExerciseHistoryDrawer({ exercise, onClose }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([])
  const [personalBest, setPersonalBest] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/training/history?exercise=${encodeURIComponent(exercise)}`)
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries ?? [])
        setPersonalBest(data.personalBest ?? 0)
      })
      .catch(() => { setEntries([]); setPersonalBest(0) })
      .finally(() => setLoading(false))
  }, [exercise])

  const chartData = entries.map(e => ({
    date: e.date,
    weight: e.weightKg,
    volume: e.volume,
  }))

  const hasWeights = entries.some(e => e.weightKg > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-2 py-4 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{exercise}</h2>
            <p className="text-xs text-gray-400 mt-0.5">All-time history</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}

          {!loading && entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No history found for this exercise.</p>
          )}

          {!loading && entries.length > 0 && (
            <>
              {personalBest > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <Trophy size={18} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Personal best</p>
                    <p className="text-xl font-bold text-amber-700">{personalBest} kg</p>
                  </div>
                </div>
              )}

              {hasWeights && chartData.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Weight progression (kg)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" kg" width={48} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} labelFormatter={l => `Date: ${l}`} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f97316' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartData.some(d => d.volume > 0) && chartData.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Volume progression (kg)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} unit=" kg" width={52} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v) => [`${v} kg`, 'Volume']} labelFormatter={l => `Date: ${l}`} />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#6366f1' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  All sets ({entries.length} total)
                </p>
                <div className="max-h-64 overflow-y-auto space-y-px">
                  {[...entries].reverse().map(e => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-xs"
                    >
                      <span className="text-gray-400 w-20 shrink-0">{e.date}</span>
                      <span className="font-medium text-gray-700">
                        {e.sets}×{e.reps}
                        {e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}
                      </span>
                      {e.rpe && <span className="text-gray-400">RPE {e.rpe}</span>}
                      {e.volume > 0 && (
                        <span className="ml-auto text-orange-500 font-medium">{e.volume} kg</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
