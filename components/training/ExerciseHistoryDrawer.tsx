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
  source?: string
  externalUrl?: string | null
}

interface Props {
  exercise: string
  onClose: () => void
}

const GOLD = '#C9A84C'
const CREAM = '#F5E6D3'
const MUTED = '#3D405B'

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-2 py-4 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-pens-surface border border-pens-muted/30 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-pens-muted/20">
          <div>
            <h2 className="font-semibold text-pens-cream text-base">{exercise}</h2>
            <p className="text-xs text-pens-cream/50 mt-0.5">All-time history</p>
          </div>
          <button onClick={onClose} className="text-pens-cream/40 hover:text-pens-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && <p className="text-sm text-pens-cream/40 text-center py-8">Loading…</p>}

          {!loading && entries.length === 0 && (
            <p className="text-sm text-pens-cream/40 text-center py-8">No history found for this exercise.</p>
          )}

          {!loading && entries.length > 0 && (
            <>
              {personalBest > 0 && (
                <div className="flex items-center gap-3 bg-pens-gold/10 border border-pens-gold/30 rounded-xl px-4 py-3">
                  <Trophy size={18} className="text-pens-gold shrink-0" />
                  <div>
                    <p className="text-xs text-pens-gold/80 font-medium">Personal best</p>
                    <p className="text-xl font-bold text-pens-gold">{personalBest} kg</p>
                  </div>
                </div>
              )}

              {hasWeights && chartData.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-pens-cream mb-2">Weight progression (kg)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={MUTED} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: CREAM, fillOpacity: 0.6 }} tickFormatter={d => d.slice(5)} stroke={MUTED} />
                      <YAxis tick={{ fontSize: 10, fill: CREAM, fillOpacity: 0.6 }} unit=" kg" width={48} domain={['auto', 'auto']} stroke={MUTED} />
                      <Tooltip
                        formatter={(v) => [`${v} kg`, 'Weight']}
                        labelFormatter={l => `Date: ${l}`}
                        contentStyle={{ background: '#0D1B2A', border: `1px solid ${MUTED}`, borderRadius: 8, color: CREAM }}
                        labelStyle={{ color: CREAM }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke={GOLD}
                        strokeWidth={2}
                        dot={{ r: 3, fill: GOLD }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartData.some(d => d.volume > 0) && chartData.length > 1 && (
                <div>
                  <p className="text-sm font-semibold text-pens-cream mb-2">Volume progression (kg)</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={MUTED} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: CREAM, fillOpacity: 0.6 }} tickFormatter={d => d.slice(5)} stroke={MUTED} />
                      <YAxis tick={{ fontSize: 10, fill: CREAM, fillOpacity: 0.6 }} unit=" kg" width={52} domain={['auto', 'auto']} stroke={MUTED} />
                      <Tooltip
                        formatter={(v) => [`${v} kg`, 'Volume']}
                        labelFormatter={l => `Date: ${l}`}
                        contentStyle={{ background: '#0D1B2A', border: `1px solid ${MUTED}`, borderRadius: 8, color: CREAM }}
                        labelStyle={{ color: CREAM }}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke={CREAM}
                        strokeWidth={2}
                        dot={{ r: 3, fill: CREAM }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-pens-cream mb-2">
                  All sets ({entries.length} total)
                </p>
                <div className="max-h-64 overflow-y-auto space-y-px">
                  {[...entries].reverse().map(e => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-pens-deep/60 text-xs text-pens-cream/80"
                    >
                      <span className="text-pens-cream/40 w-20 shrink-0">{e.date}</span>
                      <span className="font-medium">
                        {e.sets}×{e.reps}
                        {e.weightKg > 0 ? ` @ ${e.weightKg}kg` : ' BW'}
                      </span>
                      {e.rpe && <span className="text-pens-cream/40">RPE {e.rpe}</span>}
                      {e.volume > 0 && (
                        <span className="ml-auto text-pens-gold font-medium">{e.volume} kg</span>
                      )}
                      {e.source === 'strava' && e.externalUrl && (
                        <a
                          href={e.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`text-[9px] uppercase tracking-wide font-bold bg-pens-crimson/30 text-pens-cream rounded px-1 py-0.5 hover:bg-pens-crimson/50 ${e.volume > 0 ? '' : 'ml-auto'}`}
                          title="Open on Strava"
                        >
                          Strava ↗
                        </a>
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
