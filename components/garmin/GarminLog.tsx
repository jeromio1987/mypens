'use client'

import { useEffect, useState } from 'react'
import { mondayOf } from '@/lib/timeWindow'
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

function sportLabel(sport: string): string {
  return sport.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function weeklyDistanceData(activities: GarminActivity[]) {
  const map = new Map<string, number>()
  for (const a of activities) {
    if (!a.distanceM) continue
    const key = mondayOf(a.date)
    map.set(key, (map.get(key) ?? 0) + a.distanceM / 1000)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, km]) => ({
      week: new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      km: parseFloat(km.toFixed(1)),
    }))
}

interface Props {
  year: string
  sport: string
}

export default function GarminLog({ year, sport }: Props) {
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (year !== 'all') params.set('year', year)
      if (sport !== 'all') params.set('sport', sport)
      params.set('limit', '1000')
      try {
        const r = await fetch(`/api/garmin?${params}`)
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          throw new Error(`HTTP ${r.status}${body ? ` — ${body.slice(0, 200)}` : ''}`)
        }
        const data = await r.json()
        if (!Array.isArray(data)) throw new Error('Unexpected response shape from /api/garmin')
        setActivities(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [year, sport])

  if (loading)
    return <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl p-6 text-sm text-pens-cream/50">Loading…</div>

  if (error)
    return (
      <div className="bg-pens-surface border border-pens-crimson/50 rounded-2xl p-6 text-sm text-pens-cream space-y-2">
        <p className="font-medium text-pens-crimson">Couldn&apos;t load Garmin activities</p>
        <p className="text-xs text-pens-cream/60 font-mono break-all">{error}</p>
      </div>
    )

  if (activities.length === 0)
    return (
      <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl p-6 text-sm text-pens-cream/60 space-y-2">
        <p className="font-medium text-pens-cream">No Garmin activities imported yet.</p>
        <p>Drop your Garmin <code className="text-pens-gold">.fit</code> files into <code className="text-pens-gold">garmin_activities/&lt;YEAR&gt;/</code> and run <code className="text-pens-gold">python3 scripts/import-garmin.py</code> to bulk-import them.</p>
        <p className="text-xs text-pens-cream/40">For a live, going-forward sync use the <a href="/integrations" className="text-pens-gold hover:underline">/integrations</a> page instead.</p>
      </div>
    )

  const totalActivities = activities.length
  const totalDistKm = activities.reduce((s, a) => s + (a.distanceM ?? 0), 0) / 1000
  const totalTimeSec = activities.reduce((s, a) => s + a.durationSec, 0)
  const avgHrAll = activities.filter(a => a.avgHr).map(a => a.avgHr!)
  const avgHrMean = avgHrAll.length
    ? Math.round(avgHrAll.reduce((s, v) => s + v, 0) / avgHrAll.length)
    : null

  const weekly = weeklyDistanceData(activities)

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activities',     value: totalActivities.toString() },
          { label: 'Total distance', value: totalDistKm > 0 ? `${totalDistKm.toFixed(0)} km` : '—' },
          { label: 'Total time',     value: fmtDuration(totalTimeSec) },
          { label: 'Avg HR',         value: avgHrMean ? `${avgHrMean} bpm` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-pens-surface border border-pens-muted/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-semibold text-pens-gold">{value}</p>
            <p className="text-xs uppercase tracking-wider text-pens-cream/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {weekly.length > 1 && (
        <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-pens-cream">Weekly Distance (km)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D405B" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#F5E6D3', opacity: 0.6 }} stroke="#3D405B" />
              <YAxis tick={{ fontSize: 11, fill: '#F5E6D3', opacity: 0.6 }} unit=" km" width={48} stroke="#3D405B" />
              <Tooltip
                formatter={(v: unknown) => [`${v} km`, 'Distance']}
                contentStyle={{ backgroundColor: '#1B263B', border: '1px solid #3D405B', borderRadius: '8px', color: '#F5E6D3' }}
              />
              <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                {weekly.map((_, i) => (
                  <Cell key={i} fill={i === weekly.length - 1 ? '#C9A84C' : '#8B1E1E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-pens-surface border border-pens-muted/30 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-pens-cream">
          Activities
          <span className="ml-2 text-xs font-normal text-pens-cream/40">{totalActivities} total</span>
        </h2>
        <div className="space-y-px max-h-[600px] overflow-y-auto">
          {activities.map(a => {
            const isCardio = !!a.distanceM && a.distanceM > 100
            const isRunning = a.sport === 'running' || a.sport === 'walking' || a.sport === 'hiking'
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-pens-navy/40 text-sm"
              >
                <span className="text-xs uppercase tracking-wider text-pens-cream/50 w-20 flex-shrink-0" title={sportLabel(a.sport)}>
                  {sportLabel(a.sport).slice(0, 8)}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-pens-cream truncate">{a.name}</p>
                  <p className="text-xs text-pens-cream/40">
                    {new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {a.subSport ? ` · ${a.subSport}` : ''}
                  </p>
                </div>

                <span className="text-pens-cream/70 text-xs w-20 text-right flex-shrink-0">
                  {fmtDistance(a.distanceM)}
                </span>

                <span className="text-pens-cream/40 text-xs w-24 text-right hidden sm:block flex-shrink-0">
                  {isRunning && isCardio
                    ? fmtPace(a.distanceM, a.durationSec)
                    : isCardio
                    ? fmtSpeed(a.avgSpeedMs)
                    : '—'}
                </span>

                <span className="text-pens-gold text-xs font-medium w-16 text-right flex-shrink-0">
                  {fmtDuration(a.durationSec)}
                </span>

                {a.avgHr ? (
                  <span className="text-pens-crimson text-xs w-16 text-right flex-shrink-0">
                    ♥ {a.avgHr}
                  </span>
                ) : (
                  <span className="w-16 flex-shrink-0" />
                )}

                {a.calories ? (
                  <span className="text-pens-cream/50 text-xs w-16 text-right hidden sm:block flex-shrink-0">
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
