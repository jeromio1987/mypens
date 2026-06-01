'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Loader2 } from 'lucide-react'
import { analyzeTanitaCsv, type TanitaParsedRow } from '@/lib/tanitaCsv'

type Mode = 'skip' | 'overwrite'

export default function ImportTanitaPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ReturnType<typeof analyzeTanitaCsv> | null>(null)
  const [mode, setMode] = useState<Mode>('skip')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)

  const runPreview = useCallback((file: File, text: string) => {
    setClientError(null)
    setResult(null)
    setSelectedFile(file)
    setFileName(file.name)
    try {
      setPreview(analyzeTanitaCsv(text))
    } catch {
      setPreview(null)
      setSelectedFile(null)
      setBatchFiles([])
      setClientError('Could not read that file as CSV.')
    }
  }, [])

  const onFile = useCallback(
    (f: File | null) => {
      if (!f) return
      if (!f.name.toLowerCase().endsWith('.csv')) {
        setClientError('Please choose a .csv file.')
        return
      }
      setBatchFiles([])
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        runPreview(f, text)
      }
      reader.readAsText(f)
    },
    [runPreview],
  )

  const handleFileList = useCallback(
    (list: File[]) => {
      const csvs = list.filter((file) => file.name.toLowerCase().endsWith('.csv'))
      if (!csvs.length) {
        setClientError('Please choose at least one .csv file.')
        return
      }
      setClientError(null)
      setResult(null)
      if (csvs.length === 1) {
        onFile(csvs[0])
        return
      }
      setBatchFiles(csvs)
      const first = csvs[0]
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        runPreview(first, text)
        setFileName(`${csvs.length} CSV files selected`)
      }
      reader.readAsText(first)
    },
    [onFile, runPreview],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const list = Array.from(e.dataTransfer.files ?? [])
      handleFileList(list)
    },
    [handleFileList],
  )

  const onImport = async () => {
    const filesToImport = batchFiles.length > 0 ? batchFiles : selectedFile ? [selectedFile] : []
    if (!preview || filesToImport.length === 0) {
      setClientError('Select a file first.')
      return
    }

    setImporting(true)
    setResult(null)
    setClientError(null)
    let imported = 0
    let skipped = 0
    const allErrors: string[] = []
    try {
      for (const file of filesToImport) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('mode', mode)
        const res = await fetch('/api/import/tanita', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) {
          allErrors.push(
            `${file.name}: ${typeof data.error === 'string' ? data.error : 'Import failed.'}`,
          )
          if (typeof data.imported === 'number') imported += data.imported
          if (typeof data.skipped === 'number') skipped += data.skipped
          if (Array.isArray(data.errors)) {
            for (const err of data.errors) allErrors.push(`${file.name}: ${String(err)}`)
          }
          continue
        }
        imported += data.imported ?? 0
        skipped += data.skipped ?? 0
        if (Array.isArray(data.errors)) {
          for (const err of data.errors) allErrors.push(`${file.name}: ${String(err)}`)
        }
      }
      setResult({ imported, skipped, errors: allErrors })
      setBatchFiles([])
    } catch {
      setClientError('Network error — try again.')
    } finally {
      setImporting(false)
    }
  }

  const previewRows: TanitaParsedRow[] = preview?.parsed.slice(0, 5) ?? []

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/weight" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">Weight</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Import Tanita CSV</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">
                Health Planet / HealthPlanet exports → weight + body composition
              </p>
            </div>
          </div>
          <Link
            href="/weight"
            className="text-sm text-pens-gold hover:text-pens-cream transition-colors whitespace-nowrap"
          >
            Weight tracker →
          </Link>
        </div>

        <div
          className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 shadow-lg"
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
        >
          <label
            htmlFor="tanita-csv-input"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-pens-muted/50 bg-pens-deep/50 px-6 py-12 cursor-pointer hover:border-pens-gold/40 transition-colors"
          >
            <Upload className="text-pens-gold" size={28} />
            <p className="text-sm text-pens-cream text-center">
              Drop Tanita <span className="text-pens-gold">.csv</span> files here, or click to browse. Multi-select
              runs one import per file in sequence (first file drives the column preview).
            </p>
            <p className="text-xs text-pens-cream/40">Tanita Health Planet column layout is detected automatically</p>
            <input
              id="tanita-csv-input"
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? [])
                e.target.value = ''
                handleFileList(list)
              }}
            />
          </label>
        </div>

        {clientError && (
          <div className="rounded-xl border border-pens-crimson/40 bg-pens-crimson/10 px-4 py-3 text-sm text-red-200">
            {clientError}
          </div>
        )}

        {preview && (
          <div className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 shadow-lg space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-pens-cream">Column mapping</h2>
              {fileName && <span className="text-xs text-pens-cream/45">{fileName}</span>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-pens-muted/30">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-pens-deep/80 text-pens-cream/50">
                    <th className="px-3 py-2 font-medium">CSV header</th>
                    <th className="px-3 py-2 font-medium">Maps to</th>
                  </tr>
                </thead>
                <tbody className="text-pens-cream/85">
                  {preview.mappings.map((m, i) => (
                    <tr key={`${m.header}-${i}`} className="border-t border-pens-muted/20">
                      <td className="px-3 py-2 font-mono">{m.header}</td>
                      <td className="px-3 py-2">
                        {m.role === 'ignore' ? (
                          <span className="text-pens-cream/35">(ignored)</span>
                        ) : (
                          <span className="text-emerald-400/90">{m.targetField}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-pens-cream mb-2">Preview (first 5 rows)</h2>
              {previewRows.length === 0 ? (
                <p className="text-xs text-pens-cream/45">No valid data rows yet — check column detection or date/weight cells.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-pens-muted/30">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-pens-deep/80 text-pens-cream/50">
                        <th className="px-3 py-2">date</th>
                        <th className="px-3 py-2">scaleKg</th>
                        <th className="px-3 py-2">bodyFatPct</th>
                        <th className="px-3 py-2">muscle</th>
                        <th className="px-3 py-2">bone</th>
                        <th className="px-3 py-2">water%</th>
                        <th className="px-3 py-2">visceral</th>
                      </tr>
                    </thead>
                    <tbody className="text-pens-cream/90">
                      {previewRows.map(r => (
                        <tr key={`${r.date}-${r.rowNumber}`} className="border-t border-pens-muted/20">
                          <td className="px-3 py-2 font-mono">{r.date}</td>
                          <td className="px-3 py-2">{r.scaleKg}</td>
                          <td className="px-3 py-2">{r.bodyFatPct ?? '—'}</td>
                          <td className="px-3 py-2">{r.muscleMassKg ?? '—'}</td>
                          <td className="px-3 py-2">{r.boneMassKg ?? '—'}</td>
                          <td className="px-3 py-2">{r.bodyWaterPct ?? '—'}</td>
                          <td className="px-3 py-2">{r.visceralFat ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                <p className="font-medium text-amber-100/90 mb-1">Parse notes</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {preview.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {preview.errors.length > 8 && <li>…and {preview.errors.length - 8} more</li>}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-medium text-pens-cream/70">If a date already exists in MY PENS</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode('skip')}
                  className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                    mode === 'skip'
                      ? 'bg-pens-gold text-pens-deep font-medium'
                      : 'bg-pens-deep/80 text-pens-cream/70 border border-pens-muted/40'
                  }`}
                >
                  Skip existing dates
                </button>
                <button
                  type="button"
                  onClick={() => setMode('overwrite')}
                  className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                    mode === 'overwrite'
                      ? 'bg-pens-gold text-pens-deep font-medium'
                      : 'bg-pens-deep/80 text-pens-cream/70 border border-pens-muted/40'
                  }`}
                >
                  Overwrite existing dates
                </button>
              </div>
              <p className="text-[11px] text-pens-cream/40 leading-relaxed">
                Overwrite updates scale + Tanita fields on the latest entry for that date and keeps your confounder fields
                (creatine, alcohol, etc.) as they were.
              </p>
            </div>

            <button
              type="button"
              disabled={importing || !preview.parsed.length}
              onClick={onImport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pens-cream text-pens-deep px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none hover:bg-white transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Importing…{batchFiles.length > 1 ? ` (${batchFiles.length} files)` : ''}
                </>
              ) : batchFiles.length > 1 ? (
                `Import ${batchFiles.length} files`
              ) : (
                'Import to database'
              )}
            </button>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 shadow-lg space-y-3">
            <h2 className="text-sm font-semibold text-pens-cream">Import result</h2>
            <p className="text-sm text-pens-cream/80">
              <span className="text-emerald-400 font-medium">{result.imported}</span> imported ·{' '}
              <span className="text-pens-gold font-medium">{result.skipped}</span> skipped
            </p>
            {result.errors.length > 0 && (
              <div className="text-xs text-red-300/90 space-y-1">
                <p className="font-medium text-red-200">Errors / warnings</p>
                <ul className="list-disc pl-4 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/weight" className="inline-block text-sm text-pens-gold hover:text-pens-cream transition-colors">
              Open Weight tracker →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
