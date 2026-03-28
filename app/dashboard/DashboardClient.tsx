'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, TrendingUp, Minus, Download, Scale, UtensilsCrossed, Moon, Dumbbell, Ruler, DatabaseBackup, Lightbulb } from 'lucide-react'

interface DashboardData {
  weight: {
    latest: { scaleKg: number; trueWeightKg: number; date: string } | null
    avg7: number | null
    trend7: number | null
  }
  food: {
    today: { kcal: number; proteinG: number; carbsG: number; fatG: number; entries: number }
    avgKcal7: number | null
  }
  sleep: {
    latest: { hours: number; quality: number; bedtime: string; wakeTime: string; date: string } | null
    avgHours7: number | null
    avgQuality7: number | null
    avgHrv7: number | null
    daysLogged: number
  }
  training: {
    weekSessions: number
    weekVolume: number
    topExercises: { exercise: string; volume: number }[]
    lastDate: string | null
  }
  measurements: {
    latest: { waistCm: number | null; chestCm: number | null; hipsCm: number | null; date: string } | null
    delta: { waistCm: number | null; chestCm: number | null } | null
  }
  insights: string[]
}

type ConfidenceLevel = 'high' | 'medium' | 'low'

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low: 'bg-red-50 text-red-600 border border-red-200',
}

// Derive confidence from the stored weight entry context.
// The dashboard API doesn't currently send confounder counts, so we infer
// from the gap between scaleKg and trueWeightKg as a proxy until the
// entry-level confidence is exposed on the dashboard endpoint.
function inferConfidenceFromGap(scale: number, adjusted: number): ConfidenceLevel {
  const gap = parseFloat((scale - adjusted).toFixed(2))
  if (gap <= 0) return 'high'
  if (gap < 0.5) return 'medium'
  return 'low'
}

function TrendArrow({ v }: { v: number | null }) {
  if (v == null) return null
  if (v < -0.05) return <TrendingDown size={14} className="text-green-500" />
  if (v > 0.05) return <TrendingUp size={14} className="text-red-500" />
  return <Minus size={14} className="text-gray-400" />
}

function QualityDots({ q }: { q: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= q ? 'bg-violet-500' : 'bg-gray-200'}`} />
      ))}
    </span>
  )
}

const MODULES = [
  { href: '/weight', label: 'Weight', icon: Scale, color: 'text-blue-600' },
  { href: '/food', label: 'Food', icon: UtensilsCrossed, color: 'text-emerald-600' },
  { href: '/sleep', label: 'Sleep', icon: Moon, color: 'text-violet-600' },
  { href: '/training', label: 'Training', icon: Dumbbell, color: 'text-orange-500' },
  { href: '/measurements', label: 'Measurements', icon: Ruler, color: 'text-rose-600' },
]

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [exportModule, setExportModule] = useState<string>('all')
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [backupInfo, setBackupInfo] = useState<{ filename: string; sizeKb: number } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.weight) {
          setApiError(d.error ?? 'Unexpected response from dashboard API. Make sure you have run: npx prisma db push')
        } else {
          setData(d)
        }
      })
      .catch(() => setApiError('Could not reach the dashboard API.'))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    window.location.href = `/api/export?module=${exportModule}`
  }

  const handleBackup = async () => {
    setBackupStatus('loading')
    setBackupInfo(null)
    try {
      const res = await fetch('/api/backup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Backup failed')
      setBackupStatus('success')
      setBackupInfo({ filename: json.filename, sizeKb: json.sizeKb })
    } catch {
      setBackupStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Weekly Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">Last 7 days at a glance</p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        )}

        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Dashboard failed to load</p>
            <p>{apiError}</p>
            <p className="mt-3 text-red-500 font-mono text-xs">npx prisma db push</p>
          </div>
        )}

        {data && (
          <>
            {/* Weight card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-blue-600" />
                  <h2 className="font-semibold text-gray-800">Weight</h2>
                </div>
                <Link href="/weight" className="text-xs text-blue-500 hover:underline">Log →</Link>
              </div>
              {data.weight.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-3xl font-bold text-gray-900">{data.weight.latest.trueWeightKg}</span>
                    <span className="text-gray-400 text-sm">kg adjusted</span>
                    <TrendArrow v={data.weight.trend7} />
                    {(() => {
                      const conf = inferConfidenceFromGap(data.weight.latest!.scaleKg, data.weight.latest!.trueWeightKg)
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[conf]}`}>
                          {conf} confidence
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Scale: {data.weight.latest.scaleKg} kg</span>
                    {data.weight.avg7 && <span>7-day avg: {data.weight.avg7} kg</span>}
                  </div>
                  {data.weight.trend7 != null && (
                    <p className={`text-xs font-medium ${data.weight.trend7 <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {data.weight.trend7 > 0 ? '+' : ''}{data.weight.trend7} kg vs 7 days ago
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Last logged: {data.weight.latest.date}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data this week</p>
              )}
            </div>

            {/* Food card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={16} className="text-emerald-600" />
                  <h2 className="font-semibold text-gray-800">Food — Today</h2>
                </div>
                <Link href="/food" className="text-xs text-emerald-500 hover:underline">Log →</Link>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">{Math.round(data.food.today.kcal)}</span>
                <span className="text-gray-400 text-sm mb-1">kcal · {data.food.today.entries} items</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Protein', val: data.food.today.proteinG, color: 'text-blue-600' },
                  { label: 'Carbs', val: data.food.today.carbsG, color: 'text-amber-600' },
                  { label: 'Fat', val: data.food.today.fatG, color: 'text-orange-500' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl py-2">
                    <p className={`text-sm font-bold ${color}`}>{Math.round(val)}g</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              {data.food.avgKcal7 != null && (
                <p className="text-xs text-gray-400 mt-2">7-day avg: {Math.round(data.food.avgKcal7)} kcal/day</p>
              )}
            </div>

            {/* Sleep card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Moon size={16} className="text-violet-600" />
                  <h2 className="font-semibold text-gray-800">Sleep — Last night</h2>
                </div>
                <Link href="/sleep" className="text-xs text-violet-500 hover:underline">Log →</Link>
              </div>
              {data.sleep.latest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-gray-900">{data.sleep.latest.hours}h</span>
                    <QualityDots q={data.sleep.latest.quality} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {data.sleep.latest.bedtime} → {data.sleep.latest.wakeTime}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-400">
                    {data.sleep.avgHours7 != null && <span>7-day avg: {data.sleep.avgHours7}h</span>}
                    {data.sleep.avgQuality7 != null && <span>Avg quality: {data.sleep.avgQuality7}/5</span>}
                    {data.sleep.avgHrv7 != null && <span>Avg HRV: {data.sleep.avgHrv7} ms</span>}
                  </div>
                  <p className="text-xs text-gray-400">{data.sleep.daysLogged}/7 nights logged</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data this week</p>
              )}
            </div>

            {/* Training card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-orange-500" />
                  <h2 className="font-semibold text-gray-800">Training — This week</h2>
                </div>
                <Link href="/training" className="text-xs text-orange-500 hover:underline">Log →</Link>
              </div>
              <div className="flex gap-6 mb-3">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{data.training.weekSessions}</p>
                  <p className="text-xs text-gray-400">sessions</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{data.training.weekVolume.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">kg volume</p>
                </div>
              </div>
              {data.training.topExercises.length > 0 && (
                <div className="space-y-1">
                  {data.training.topExercises.map(({ exercise, volume }) => (
                    <div key={exercise} className="flex justify-between text-xs text-gray-600">
                      <span>{exercise}</span>
                      <span className="text-gray-400">{volume.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              )}
              {!data.training.weekSessions && (
                <p className="text-sm text-gray-400">No sessions this week</p>
              )}
            </div>

            {/* Measurements card */}
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-rose-600" />
                  <h2 className="font-semibold text-gray-800">Measurements</h2>
                </div>
                <Link href="/measurements" className="text-xs text-rose-500 hover:underline">Log →</Link>
              </div>
              {data.measurements.latest ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">{data.measurements.latest.date}</p>
                  <div className="flex gap-4 text-sm">
                    {data.measurements.latest.waistCm != null && (
                      <div>
                        <span className="font-bold text-gray-900">{data.measurements.latest.waistCm}</span>
                        <span className="text-gray-400 text-xs"> cm waist</span>
                        {data.measurements.delta?.waistCm != null && (
                          <span className={`ml-1 text-xs font-medium ${data.measurements.delta.waistCm <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ({data.measurements.delta.waistCm > 0 ? '+' : ''}{data.measurements.delta.waistCm})
                          </span>
                        )}
                      </div>
                    )}
                    {data.measurements.latest.chestCm != null && (
                      <div>
                        <span className="font-bold text-gray-900">{data.measurements.latest.chestCm}</span>
                        <span className="text-gray-400 text-xs"> cm chest</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No measurements logged yet</p>
              )}
            </div>

            {/* Insights card */}
            {data.insights && data.insights.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-yellow-500" />
                  <h2 className="font-semibold text-gray-800">Weekly Insights</h2>
                </div>
                <div className="space-y-3">
                  {data.insights.map((insight, i) => (
                    <p key={i} className="text-sm text-gray-600 leading-relaxed border-l-2 border-yellow-200 pl-3">
                      {insight}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">Rule-based · Based on last 7 days of logged data</p>
              </div>
            )}

            {/* Quick-log bar */}
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">Quick log</p>
              <div className="flex gap-2 flex-wrap">
                {MODULES.map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                  >
                    <Icon size={14} className={color} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Download size={16} className="text-gray-500" />
                Export to CSV
              </h2>
              <div className="flex gap-2">
                <select
                  value={exportModule}
                  onChange={e => setExportModule(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700"
                >
                  <option value="all">All modules</option>
                  <option value="weight">Weight</option>
                  <option value="food">Food</option>
                  <option value="sleep">Sleep</option>
                  <option value="training">Training</option>
                  <option value="measurements">Measurements</option>
                </select>
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                &quot;All modules&quot; exports each section separated by headers in one file.
              </p>
            </div>

            {/* Backup */}
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <DatabaseBackup size={16} className="text-gray-500" />
                Database Backup
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Copies the SQLite database file to <code className="bg-gray-100 px-1 rounded">prisma/backups/</code> with a timestamp. Last 10 backups are kept automatically.
              </p>
              <button
                type="button"
                onClick={handleBackup}
                disabled={backupStatus === 'loading'}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <DatabaseBackup size={14} />
                {backupStatus === 'loading' ? 'Backing up…' : 'Back up now'}
              </button>
              {backupStatus === 'success' && backupInfo && (
                <p className="text-xs text-emerald-600 mt-2">
                  ✓ Saved as <code className="bg-emerald-50 px-1 rounded">{backupInfo.filename}</code> ({backupInfo.sizeKb} KB)
                </p>
              )}
              {backupStatus === 'error' && (
                <p className="text-xs text-red-500 mt-2">Backup failed — check the server logs.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
