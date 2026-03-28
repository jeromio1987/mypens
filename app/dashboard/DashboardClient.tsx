'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, TrendingDown, TrendingUp, Minus, Download, Upload, Scale,
  UtensilsCrossed, Moon, Dumbbell, Ruler, DatabaseBackup,
  Plane, Thermometer, Palmtree, Salad, Trophy, Tag,
  CheckCircle, AlertTriangle, Info, CalendarDays,
} from 'lucide-react'
import type { StructuredInsight } from '@/app/api/dashboard/route'

interface EventTag { id: string; type: string; label: string; startDate: string; endDate: string; notes?: string | null }

interface DashboardData {
  weight: {
    latest: {
      scaleKg: number; trueWeightKg: number; date: string
      confidence: 'high' | 'medium' | 'low' | null
      activeConfounders: number
    } | null
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
  events: {
    active: EventTag[]
    recent: EventTag[]
  }
  insights: StructuredInsight[]
}

type ConfidenceLevel = 'high' | 'medium' | 'low'

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low:    'bg-red-50 text-red-600 border border-red-200',
}

const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  high:   'No confounders — reading is reliable',
  medium: '1–2 factors affecting reading',
  low:    'Multiple factors — rough estimate',
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  travel: Plane, illness: Thermometer, holiday: Palmtree,
  'diet-break': Salad, competition: Trophy, other: Tag,
}

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  travel:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  illness:      { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  holiday:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'diet-break': { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  competition:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  other:        { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200' },
}

const INSIGHT_SEVERITY_STYLES: Record<string, { icon: React.ElementType; border: string; iconColor: string; bg: string }> = {
  positive: { icon: CheckCircle,  border: 'border-emerald-200', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
  warning:  { icon: AlertTriangle,border: 'border-amber-200',   iconColor: 'text-amber-500',   bg: 'bg-amber-50' },
  info:     { icon: Info,         border: 'border-blue-200',    iconColor: 'text-blue-400',    bg: 'bg-blue-50' },
}

function TrendArrow({ v }: { v: number | null }) {
  if (v == null) return null
  if (v < -0.05) return <TrendingDown size={14} className="text-green-500" />
  if (v > 0.05)  return <TrendingUp   size={14} className="text-red-500" />
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
  { href: '/weight',       label: 'Weight',       icon: Scale,          color: 'text-blue-600' },
  { href: '/food',         label: 'Food',         icon: UtensilsCrossed,color: 'text-emerald-600' },
  { href: '/sleep',        label: 'Sleep',        icon: Moon,           color: 'text-violet-600' },
  { href: '/training',     label: 'Training',     icon: Dumbbell,       color: 'text-orange-500' },
  { href: '/measurements', label: 'Measurements', icon: Ruler,          color: 'text-rose-600' },
  { href: '/events',       label: 'Events',       icon: CalendarDays,   color: 'text-sky-600' },
]

export default function DashboardClient() {
  const [data, setData]             = useState<DashboardData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [apiError, setApiError]     = useState<string | null>(null)
  const [exportModule, setExportModule] = useState<string>('all')
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [backupInfo, setBackupInfo] = useState<{ filename: string; sizeKb: number } | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [importResult, setImportResult] = useState<{ module: string; inserted: number; skipped: number; total: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.weight) {
          setApiError(d.error ?? 'Unexpected response. Make sure you have run: npx prisma db push')
        } else {
          setData(d)
        }
      })
      .catch(() => setApiError('Could not reach the dashboard API.'))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = () => { window.location.href = `/api/export?module=${exportModule}` }

  const handleBackup = async () => {
    setBackupStatus('loading'); setBackupInfo(null)
    try {
      const res = await fetch('/api/backup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Backup failed')
      setBackupStatus('success')
      setBackupInfo({ filename: json.filename, sizeKb: json.sizeKb })
    } catch { setBackupStatus('error') }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('loading'); setImportResult(null); setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportStatus('success')
      setImportResult(json)
    } catch (err: unknown) {
      setImportStatus('error')
      setImportError(err instanceof Error ? err.message : 'Import failed')
    }
    if (fileRef.current) fileRef.current.value = ''
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

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}

        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
            <p className="font-semibold mb-1">Dashboard failed to load</p>
            <p>{apiError}</p>
            <p className="mt-3 text-red-500 font-mono text-xs">npx prisma db push</p>
          </div>
        )}

        {data && (
          <>
            {/* Active event banners */}
            {data.events.active.length > 0 && (
              <div className="space-y-2">
                {data.events.active.map(event => {
                  const cfg = EVENT_COLORS[event.type] ?? EVENT_COLORS.other
                  const Icon = EVENT_ICONS[event.type] ?? Tag
                  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  return (
                    <div key={event.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                      <Icon size={15} className={`${cfg.text} shrink-0`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${cfg.text}`}>{event.label}</p>
                        <p className={`text-xs opacity-60 ${cfg.text}`}>
                          {fmt(event.startDate)}{event.startDate !== event.endDate ? ` – ${fmt(event.endDate)}` : ''}
                        </p>
                      </div>
                      <Link href="/events" className={`text-xs underline opacity-60 ${cfg.text}`}>Manage</Link>
                    </div>
                  )
                })}
              </div>
            )}

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
                    {data.weight.latest.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[data.weight.latest.confidence]}`}>
                        {data.weight.latest.confidence} confidence
                      </span>
                    )}
                  </div>
                  {data.weight.latest.confidence && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Info size={11} className="shrink-0" />
                      {CONFIDENCE_DESCRIPTIONS[data.weight.latest.confidence]}
                      {data.weight.latest.activeConfounders > 0 && ` · ${data.weight.latest.activeConfounders} active factor${data.weight.latest.activeConfounders > 1 ? 's' : ''}`}
                    </p>
                  )}
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
                  { label: 'Carbs',   val: data.food.today.carbsG,   color: 'text-amber-600' },
                  { label: 'Fat',     val: data.food.today.fatG,     color: 'text-orange-500' },
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
                  <p className="text-sm text-gray-500">{data.sleep.latest.bedtime} → {data.sleep.latest.wakeTime}</p>
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
              {!data.training.weekSessions && <p className="text-sm text-gray-400">No sessions this week</p>}
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

            {/* Structured Insights */}
            {data.insights && data.insights.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-700 text-sm px-1">Weekly insights</h2>
                {data.insights.map(insight => {
                  const cfg = INSIGHT_SEVERITY_STYLES[insight.severity] ?? INSIGHT_SEVERITY_STYLES.info
                  const Icon = cfg.icon
                  return (
                    <div key={insight.id} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <Icon size={16} className={`${cfg.iconColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 mb-1">{insight.title}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{insight.body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 px-1">Rule-based · Based on last 7 days of logged data</p>
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
                &quot;All modules&quot; exports each section in one file.
              </p>
            </div>

            {/* Import */}
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Upload size={16} className="text-gray-500" />
                Import from CSV
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Upload a CSV previously exported from MY PENS. The module is auto-detected from the column headers.
                Duplicate entries may be skipped (sleep and measurements upsert by date; weight and food always create new rows).
              </p>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    importStatus === 'loading'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Upload size={14} />
                  {importStatus === 'loading' ? 'Importing…' : 'Choose CSV file'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={importStatus === 'loading'}
                  onChange={handleImport}
                />
              </label>
              {importStatus === 'success' && importResult && (
                <p className="text-xs text-emerald-600 mt-2">
                  ✓ Imported {importResult.inserted} rows into <strong>{importResult.module}</strong>
                  {importResult.skipped > 0 && ` · ${importResult.skipped} skipped`}
                </p>
              )}
              {importStatus === 'error' && importError && (
                <p className="text-xs text-red-500 mt-2">{importError}</p>
              )}
            </div>

            {/* Backup */}
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <DatabaseBackup size={16} className="text-gray-500" />
                Database Backup
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Copies the SQLite database to <code className="bg-gray-100 px-1 rounded">prisma/backups/</code> with a timestamp. Last 10 backups are kept automatically.
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
