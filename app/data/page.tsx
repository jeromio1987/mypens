'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Download, Upload, DatabaseBackup,
  Scale, UtensilsCrossed, Moon, Dumbbell, Ruler, Layers,
  CheckCircle, AlertCircle, Info, FileText,
} from 'lucide-react'

interface ImportResult { module: string; inserted: number; skipped: number; total: number }

const MODULES = [
  { value: 'weight',       label: 'Weight',       icon: Scale,           color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    desc: 'date, scaleKg, trueWeightKg, creatineDoseG, alcoholUnits, carbsG, hardTraining…' },
  { value: 'food',         label: 'Food',         icon: UtensilsCrossed, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'date, meal, name, kcal, proteinG, carbsG, fatG, fiberG, notes' },
  { value: 'sleep',        label: 'Sleep',        icon: Moon,            color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  desc: 'date, bedtime, wakeTime, hours, quality, hrv, notes' },
  { value: 'training',     label: 'Training',     icon: Dumbbell,        color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200',  desc: 'date, exercise, sets, reps, weightKg, volume, rpe, notes' },
  { value: 'measurements', label: 'Measurements', icon: Ruler,           color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    desc: 'date, waistCm, chestCm, hipsCm, leftArmCm, rightArmCm, leftThighCm, rightThighCm, neckCm' },
]

type BackupStatus = 'idle' | 'loading' | 'success' | 'error'
type ImportStatus = 'idle' | 'loading' | 'success' | 'error'

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [backupInfo, setBackupInfo]     = useState<{ filename: string; sizeKb: number } | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError]   = useState<string | null>(null)
  const [showFormat, setShowFormat]     = useState(false)

  const handleExport = (module: string) => {
    window.location.href = `/api/export?module=${module}`
  }

  const handleBackup = async () => {
    setBackupStatus('loading')
    setBackupInfo(null)
    try {
      const res  = await fetch('/api/backup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Backup failed')
      setBackupStatus('success')
      setBackupInfo({ filename: json.filename, sizeKb: json.sizeKb })
    } catch {
      setBackupStatus('error')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('loading')
    setImportResult(null)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/import', { method: 'POST', body: fd })
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
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">Export, import and back up your data</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
          <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            All data lives locally on this device in SQLite. Use <strong>Export</strong> to get a portable CSV, <strong>Backup</strong> to snapshot the full database, and <strong>Import</strong> to load a previously exported CSV back in.
          </p>
        </div>

        {/* ── Export ─────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Download size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Export to CSV</h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {MODULES.map(({ value, label, icon: Icon, color, bg, border, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleExport(value)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${bg} ${border} hover:opacity-80 transition-opacity text-left`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={15} className={color} />
                  <div>
                    <p className={`text-sm font-medium ${color}`}>{label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{desc}</p>
                  </div>
                </div>
                <Download size={13} className="text-gray-400 shrink-0 ml-2" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleExport('all')}
              className="flex items-center justify-between px-4 py-3 rounded-xl border bg-gray-800 border-gray-700 hover:bg-gray-900 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Layers size={15} className="text-gray-300" />
                <div>
                  <p className="text-sm font-medium text-white">All modules</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Single file with all sections</p>
                </div>
              </div>
              <Download size={13} className="text-gray-400 shrink-0 ml-2" />
            </button>
          </div>
        </section>

        {/* ── Import ─────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-gray-500" />
              <h2 className="font-semibold text-gray-800">Import from CSV</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowFormat(f => !f)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
            >
              <FileText size={11} />
              {showFormat ? 'Hide' : 'Format guide'}
            </button>
          </div>

          {showFormat && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Expected column headers per module</p>
              {MODULES.map(({ value, label, desc }) => (
                <div key={value}>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
                  <p className="text-[10px] font-mono text-gray-500 break-all">{desc}</p>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 pt-1">
                The module is auto-detected from column headers. Sleep and measurements upsert by date. Weight and food always add new rows — deduplicate before importing if needed.
              </p>
            </div>
          )}

          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition-colors ${
            importStatus === 'loading' ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
          }`}>
            <Upload size={20} className={importStatus === 'loading' ? 'text-gray-300' : 'text-gray-400'} />
            <span className="text-sm text-gray-500 font-medium">
              {importStatus === 'loading' ? 'Importing…' : 'Click to choose a CSV file'}
            </span>
            <span className="text-xs text-gray-400">Only .csv files exported from MY PENS</span>
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
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-700">
                <p className="font-semibold">Import successful</p>
                <p>{importResult.inserted} rows added to <strong>{importResult.module}</strong>{importResult.skipped > 0 ? ` · ${importResult.skipped} skipped (duplicates)` : ''}</p>
              </div>
            </div>
          )}

          {importStatus === 'error' && importError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                <p className="font-semibold">Import failed</p>
                <p>{importError}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Backup ─────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <DatabaseBackup size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Database Backup</h2>
          </div>
          <p className="text-xs text-gray-400">
            Snapshots the full SQLite database to <code className="bg-gray-100 px-1 rounded">prisma/backups/</code> with a timestamp. The last 10 backups are kept automatically.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backupStatus === 'loading'}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <DatabaseBackup size={14} />
            {backupStatus === 'loading' ? 'Creating backup…' : 'Back up now'}
          </button>

          {backupStatus === 'success' && backupInfo && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-700">
                <p className="font-semibold">Backup created</p>
                <p><code className="bg-emerald-100 px-1 rounded">{backupInfo.filename}</code> · {backupInfo.sizeKb} KB</p>
              </div>
            </div>
          )}

          {backupStatus === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">Backup failed — check the server logs.</p>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
