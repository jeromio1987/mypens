'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface Entry {
  id: string
  createdAt: string
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe?: number | null
  notes?: string | null
  volume: number
}

interface Summary {
  personalBestKg: number
  maxSessionVolume: number
  totalSessions: number
  firstDate: string
  lastDate: string
}

const ORANGE = '#f97316'
const MUTED = '#3D405B'
const MUTED_FILL = '#3d405bcc'

function titleCase(name: string) {
  return name
    .split(/\s+/g)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function ExerciseProgressPage() {
  const params = useParams()
  const raw = params?.name
  const segment = typeof raw === 'string' ? raw : raw?.[0] ?? ''

  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [canonical, setCanonical] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      if (!segment) {
        setLoading(false)
        setEntries([])
        setSummary(null)
        setCanonical('')
        return
      }
      setLoading(true)
      try {
        const r = await fetch(`/api/training/exercise/${encodeURIComponent(decodeURIComponent(segment))}`)
        const d = await r.json()
        if (Array.isArray(d.entries)) {
          setEntries(d.entries)
          setSummary(d.summary ?? null)
          setCanonical(typeof d.canonicalName === 'string' ? d.canonicalName : '')
        } else {
          setEntries([])
          setSummary(null)
          setCanonical('')
        }
      } catch {
        setEntries([])
        setSummary(null)
        setCanonical('')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [segment])

  const displayName = canonical.trim() || titleCase(decodeURIComponent(segment))

  const chartData = useMemo(
    () =>
      entries.map((e, i) => ({
        i,
        dayLabel: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        weightKg: e.weightKg,
        volume: e.volume,
        sets: e.sets,
        reps: e.reps,
        isoDate: e.date,
      })),
    [entries],
  )

  const tableRows = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const d = b.date.localeCompare(a.date)
        if (d !== 0) return d
        return String(b.createdAt).localeCompare(String(a.createdAt))
      }),
    [entries],
  )

  const pb = summary?.personalBestKg ?? 0

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/training"
              className="text-sm text-pens-gold hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft size={16} className="inline" />
              Training
            </Link>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl font-bold text-pens-cream">{displayName}</h1>
              {pb > 0 && (
                <span className="text-xs font-semibold uppercase tracking-wide text-pens-gold px-3 py-1 rounded-full bg-pens-gold/10 border border-pens-gold/35">
                  PB: {pb} kg
                </span>
              )}
            </div>
            {!loading && entries.length === 0 && (
              <p className="text-sm text-pens-cream/45">
                No entries for this exercise yet.{' '}
                <Link href="/training" className="text-pens-gold hover:underline">
                  Log one on Training
                </Link>
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 p-8 text-center text-pens-cream/40 text-sm animate-pulse">
            Loading progression…
          </div>
        ) : summary && entries.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">
                  Personal best
                </p>
                <p className="text-xl font-bold text-orange-400 mt-1">{summary.personalBestKg} kg</p>
              </div>
              <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">
                  Total sessions
                </p>
                <p className="text-xl font-bold text-pens-cream mt-1">{summary.totalSessions}</p>
              </div>
              <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">
                  First logged
                </p>
                <p className="text-lg font-semibold text-pens-cream mt-1">
                  {summary.firstDate
                    ? new Date(summary.firstDate + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-pens-cream mb-4 uppercase tracking-wide">
                Progression
              </h2>
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={MUTED} opacity={0.35} />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      stroke={MUTED}
                      interval="preserveStartEnd"
                      minTickGap={36}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="kg"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      stroke={MUTED}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => `${v}`}
                      label={{ value: 'kg', position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
                      width={40}
                    />
                    <YAxis
                      yAxisId="vol"
                      orientation="right"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      stroke={MUTED}
                      domain={['auto', 'auto']}
                      width={44}
                      label={{ value: 'vol.', position: 'insideRight', fill: '#6b7280', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0d1b2a',
                        border: `1px solid ${MUTED}`,
                        borderRadius: 12,
                        color: '#F5E6D3',
                      }}
                      formatter={(value, name, item) => {
                        const dk = item?.dataKey as string | undefined
                        const v = value ?? '—'
                        if (dk === 'weightKg' || String(name ?? '').includes('Weight'))
                          return [`${v} kg`, 'Weight']
                        if (dk === 'volume' || String(name) === 'Volume')
                          return [`${v} kg`, 'Volume']
                        return [v, String(name ?? '')]
                      }}
                      labelFormatter={(_lbl, payload) => {
                        const p = payload?.[0]?.payload as
                          | { isoDate?: string; sets?: number; reps?: number; weightKg?: number; volume?: number }
                          | undefined
                        const iso = p?.isoDate
                        const day =
                          iso
                            ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : ''
                        return p
                          ? `${day} · ${p.sets}×${p.reps} @ ${p.weightKg} kg`
                          : String(_lbl ?? '')
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#F5E6D3' }} />
                    <Bar
                      yAxisId="vol"
                      name="Volume"
                      dataKey="volume"
                      fill={MUTED_FILL}
                      barSize={10}
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="kg"
                      name="Weight (kg)"
                      type="monotone"
                      dataKey="weightKg"
                      stroke={ORANGE}
                      strokeWidth={2}
                      dot={{ r: 3, fill: ORANGE }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-pens-muted/25">
                <h2 className="text-sm font-semibold text-pens-cream uppercase tracking-wide">Session log</h2>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-pens-deep/95 backdrop-blur text-[10px] uppercase tracking-widest text-pens-cream/45">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Sets × Reps @ Weight</th>
                      <th className="px-4 py-2 font-semibold">RPE</th>
                      <th className="px-4 py-2 font-semibold text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="text-pens-cream/90 divide-y divide-pens-muted/20">
                    {tableRows.map(e => (
                      <tr key={e.id} className="hover:bg-pens-deep/40">
                        <td className="px-4 py-2.5 whitespace-nowrap text-pens-cream/70">
                          {new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          {e.sets}×{e.reps}
                          {e.weightKg > 0 ? ` @ ${e.weightKg} kg` : ' BW'}
                        </td>
                        <td className="px-4 py-2.5 text-pens-cream/50">{e.rpe ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-pens-gold font-medium tabular-nums whitespace-nowrap">
                          {e.volume > 0 ? `${e.volume} kg` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
