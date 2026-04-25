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
  { value: 'weight',       label: 'Weight',       icon: Scale,           accent: 'text-blue-300',    desc: 'date, scaleKg, trueWeightKg, creatineDoseG, alcoholUnits, carbsG, hardTraining…' },
  { value: 'food',         label: 'Food',         icon: UtensilsCrossed, accent: 'text-emerald-300', desc: 'date, meal, name, kcal, proteinG, carbsG, fatG, fiberG, notes' },
  { value: 'sleep',        label: 'Sleep',        icon: Moon,            accent: 'text-violet-300',  desc: 'date, bedtime, wakeTime, hours, quality, hrv, notes' },
  { value: 'training',     label: 'Training',     icon: Dumbbell,        accent: 'text-orange-300',  desc: 'date, exercise, sets, reps, weightKg, volume, rpe, notes' },
  { value: 'measurements', label: 'Measurements', icon: Ruler,           accent: 'text-rose-300',    desc: 'date, waistCm, chestCm, hipsCm, leftArmCm, rightArmCm, leftThighCm, rightThighCm, neckCm' },
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
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
            <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Data Management</h1>
            <p className="text-xs text-pens-cream/40 mt-0.5">Export, import and back up your data</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-pens-surface/60 border border-pens-muted/20 rounded-2xl px-4 py-3">
          <Info size={15} className="text-pens-gold shrink-0 mt-0.5" />
          <p className="text-xs text-pens-cream/60 leading-relaxed">
            All data lives locally on this device in SQLite. Use <strong className="text-pens-cream">Export</strong> to get a portable CSV, <strong className="text-pens-cream">Backup</strong> to snapshot the full database, and <strong className="text-pens-cream">Import</strong> to load a previously exported CSV back in.
          </p>
        </div>

        {/* ── Export ─────────────────────────────────────────────────────────── */}
        <section className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Download size={16} className="text-pens-cream/60" />
            <h2 className="font-semibold text-pens-cream">Export to CSV</h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {MODULES.map(({ value, label, icon: Icon, accent, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleExport(value)}
                className="flex items-center justify-between px-4 py-3 rounded-xl border bg-pens-navy/40 border-pens-muted/20 hover:border-pens-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={15} className={accent} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${accent}`}>{label}</p>
                    <p className="text-[10px] text-pens-cream/40 mt-0.5 font-mono truncate">{desc}</p>
                  </div>
                </div>
                <Download size={13} className="text-pens-cream/30 shrink-0 ml-2" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleExport('all')}
              className="flex items-center justify-between px-4 py-3 rounded-xl border bg-pens-crimson/15 border-pens-crimson/40 hover:bg-pens-crimson/20 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Layers size={15} className="text-pens-cream" />
                <div>
                  <p className="text-sm font-medium text-pens-cream">All modules</p>
                  <p className="text-[10px] text-pens-cream/50 mt-0.5">Single file with all sections</p>
                </div>
              </div>
              <Download size={13} className="text-pens-cream/60 shrink-0 ml-2" />
            </button>
          </div>
        </section>

        {/* ── Import ─────────────────────────────────────────────────────────── */}
        <section className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-pens-cream/60" />
              <h2 className="font-semibold text-pens-cream">Import from CSV</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowFormat(f => !f)}
              className="flex items-center gap-1 text-xs text-pens-gold hover:text-pens-cream transition-colors"
            >
              <FileText size={11} />
              {showFormat ? 'Hide' : 'Format guide'}
            </button>
          </div>

          {showFormat && (
            <div className="bg-pens-navy/40 border border-pens-muted/20 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-pens-cream/70">Expected column headers per module</p>
              {MODULES.map(({ value, label, desc }) => (
                <div key={value}>
                  <p className="text-[10px] font-semibold text-pens-cream/60 uppercase tracking-wide">{label}</p>
                  <p className="text-[10px] font-mono text-pens-cream/40 break-all">{desc}</p>
                </div>
              ))}
              <p className="text-[10px] text-pens-cream/40 pt-1">
                The module is auto-detected from column headers. Sleep and measurements upsert by date. Weight and food always add new rows — deduplicate before importing if needed.
              </p>
            </div>
          )}

          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition-colors ${
            importStatus === 'loading' ? 'border-pens-muted/20 bg-pens-navy/40 cursor-not-allowed' : 'border-pens-muted/30 hover:border-pens-gold/60 hover:bg-pens-navy/30'
          }`}>
            <Upload size={20} className={importStatus === 'loading' ? 'text-pens-cream/20' : 'text-pens-cream/40'} />
            <span className="text-sm text-pens-cream/60 font-medium">
              {importStatus === 'loading' ? 'Importing…' : 'Click to choose a CSV file'}
            </span>
            <span className="text-xs text-pens-cream/40">Only .csv files exported from MY PENS</span>
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
            <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200">
                <p className="font-semibold">Import successful</p>
                <p>{importResult.inserted} rows added to <strong>{importResult.module}</strong>{importResult.skipped > 0 ? ` · ${importResult.skipped} skipped (duplicates)` : ''}</p>
              </div>
            </div>
          )}

          {importStatus === 'error' && importError && (
            <div className="flex items-start gap-2 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-pens-crimson shrink-0 mt-0.5" />
              <div className="text-xs text-red-300">
                <p className="font-semibold">Import failed</p>
                <p>{importError}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── Backup ─────────────────────────────────────────────────────────── */}
        <section className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <DatabaseBackup size={16} className="text-pens-cream/60" />
            <h2 className="font-semibold text-pens-cream">Database Backup</h2>
          </div>
          <p className="text-xs text-pens-cream/50">
            Snapshots the full SQLite database to <code className="bg-pens-navy/60 px-1 rounded text-pens-cream/70">prisma/backups/</code> with a timestamp. The last 10 backups are kept automatically.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backupStatus === 'loading'}
            className="flex items-center gap-2 bg-pens-navy/60 hover:bg-pens-navy text-pens-cream/80 hover:text-pens-cream text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 border border-pens-muted/20"
          >
            <DatabaseBackup size={14} />
            {backupStatus === 'loading' ? 'Creating backup…' : 'Back up now'}
          </button>

          {backupStatus === 'success' && backupInfo && (
            <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200">
                <p className="font-semibold">Backup created</p>
                <p><code className="bg-emerald-900/40 px-1 rounded">{backupInfo.filename}</code> · {backupInfo.sizeKb} KB</p>
              </div>
            </div>
          )}

          {backupStatus === 'error' && (
            <div className="flex items-start gap-2 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-pens-crimson shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">Backup failed — check the server logs.</p>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
