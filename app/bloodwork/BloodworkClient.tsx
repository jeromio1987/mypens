'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Camera, FlaskConical, ChevronRight } from 'lucide-react'

type PanelRow = {
  id: string
  drawDate: string
  labName: string | null
  fasting: boolean
  notes: string | null
  markerCount: number
}

type Settings = {
  labsWearableContextEnabled: boolean
  labsLongevityLensEnabled: boolean
}

type DraftMarker = {
  code: string
  label: string
  valueNum: number | null
  valueText: string | null
  unit: string | null
  refLow: number | null
  refHigh: number | null
}

type PhotoDraft = {
  drawDate: string | null
  labName: string | null
  fasting: boolean | null
  markers: DraftMarker[]
  disclaimer?: string
}

export default function BloodworkClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [panels, setPanels] = useState<PanelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [drawDate, setDrawDate] = useState('')
  const [labName, setLabName] = useState('')
  const [fasting, setFasting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PhotoDraft | null>(null)

  const load = () => {
    fetch('/api/bloodwork/panels')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setPanels(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.labsWearableContextEnabled === 'boolean') {
          setSettings({
            labsWearableContextEnabled: d.labsWearableContextEnabled,
            labsLongevityLensEnabled: d.labsLongevityLensEnabled,
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const day = String(t.getDate()).padStart(2, '0')
    setDrawDate(`${y}-${m}-${day}`)
  }, [])

  const patchSetting = async (key: keyof Settings, value: boolean) => {
    const prev = settings
    setSettings(s => (s ? { ...s, [key]: value } : s))
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSettings({
        labsWearableContextEnabled: d.labsWearableContextEnabled,
        labsLongevityLensEnabled: d.labsLongevityLensEnabled,
      })
    } catch {
      setSettings(prev)
    }
  }

  const createPanel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!drawDate || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/bloodwork/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawDate,
          labName: labName.trim() || null,
          fasting,
          markers: [],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      router.push(`/bloodwork/${d.id}`)
    } catch {
      /* toast later */
    } finally {
      setSaving(false)
    }
  }

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAnalyzing(true)
    setPhotoError(null)
    setDraft(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/bloodwork/photo-analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analyze failed')
      setDraft({
        drawDate: data.drawDate ?? null,
        labName: data.labName ?? null,
        fasting: typeof data.fasting === 'boolean' ? data.fasting : null,
        markers: Array.isArray(data.markers) ? data.markers : [],
        disclaimer: data.disclaimer,
      })
      if (data.drawDate) setDrawDate(data.drawDate)
      if (data.labName) setLabName(String(data.labName))
      if (typeof data.fasting === 'boolean') setFasting(data.fasting)
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Analyze failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmDraft = async () => {
    if (!draft || saving) return
    const date = draft.drawDate && /^\d{4}-\d{2}-\d{2}$/.test(draft.drawDate) ? draft.drawDate : drawDate
    if (!date) return
    setSaving(true)
    try {
      const res = await fetch('/api/bloodwork/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawDate: date,
          labName: (draft.labName || labName).trim() || null,
          fasting: draft.fasting ?? fasting,
          markers: draft.markers.map((m, i) => ({
            code: m.code,
            label: m.label,
            valueNum: m.valueNum,
            valueText: m.valueText,
            unit: m.unit,
            refLow: m.refLow,
            refHigh: m.refHigh,
            sortOrder: i,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setDraft(null)
      router.push(`/bloodwork/${d.id}`)
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream pb-24">
      <header className="sticky top-0 z-40 bg-pens-deep/95 backdrop-blur border-b border-pens-muted/20">
        <div className="max-w-screen-lg mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <FlaskConical className="text-rose-400 shrink-0" size={22} />
            <div className="min-w-0">
              <h1 className="text-lg font-[family-name:var(--font-headline)] font-bold italic truncate">Bloodwork</h1>
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/40">Ledger · context · prevention lens</p>
            </div>
          </div>
          <Link href="/" className="text-xs text-pens-cream/40 hover:text-pens-cream/70 shrink-0">
            ← Home
          </Link>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto px-6 py-10 space-y-10">
        <p className="text-sm text-pens-cream/55 leading-relaxed max-w-2xl">
          Manual entry or photo OCR draft. This module is for <strong className="text-pens-cream/80">self-tracking and context</strong> — not diagnosis or
          treatment. Discuss results with a clinician.
        </p>

        {settings && (
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-pens-muted/25 bg-pens-surface/40 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.labsWearableContextEnabled}
                onChange={e => patchSetting('labsWearableContextEnabled', e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold text-pens-cream">Wearable context panels</p>
                <p className="text-xs text-pens-cream/45 mt-1">
                  On each panel, show sleep + training totals for the window before the draw — framed as life context, never causation.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-4 rounded-xl border border-pens-muted/25 bg-pens-surface/40 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.labsLongevityLensEnabled}
                onChange={e => patchSetting('labsLongevityLensEnabled', e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold text-pens-cream">Longevity / prevention lens</p>
                <p className="text-xs text-pens-cream/45 mt-1">
                  Softer copy plus educational retest-interval hints by marker family — still not medical scheduling.
                </p>
              </div>
            </label>
          </div>
        )}

        <section className="rounded-2xl border border-rose-500/25 bg-pens-surface/30 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-rose-300/90">Photo → draft</h2>
              <p className="text-xs text-pens-cream/45 mt-1">Upload a lab report photo. Review every value before saving.</p>
            </div>
            <button
              type="button"
              disabled={analyzing}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-sm font-semibold disabled:opacity-50"
            >
              <Camera size={16} />
              {analyzing ? 'Reading…' : 'Upload photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
          </div>
          {photoError && <p className="text-sm text-red-300">{photoError}</p>}
          {draft && (
            <div className="space-y-3 border-t border-pens-muted/20 pt-4">
              <p className="text-xs text-pens-cream/50">
                Draft · {draft.markers.length} markers
                {draft.drawDate ? ` · ${draft.drawDate}` : ''}
                {draft.labName ? ` · ${draft.labName}` : ''}
              </p>
              <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-pens-cream/70">
                {draft.markers.slice(0, 20).map((m, i) => (
                  <li key={`${m.code}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">{m.label}</span>
                    <span className="tabular-nums shrink-0">
                      {m.valueNum != null ? m.valueNum : m.valueText ?? '—'}
                      {m.unit ? ` ${m.unit}` : ''}
                    </span>
                  </li>
                ))}
                {draft.markers.length > 20 && (
                  <li className="text-pens-cream/40">…and {draft.markers.length - 20} more</li>
                )}
              </ul>
              <p className="text-[10px] text-pens-cream/35">{draft.disclaimer}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || draft.markers.length === 0}
                  onClick={confirmDraft}
                  className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Confirm → create panel'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-4 py-2 rounded-lg border border-pens-muted/40 text-sm text-pens-cream/70"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-pens-muted/25 bg-pens-surface/30 p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-pens-cream/50 mb-4">New panel</h2>
          <form onSubmit={createPanel} className="flex flex-col md:flex-row md:flex-wrap gap-4 items-end">
            <div className="w-full md:w-auto">
              <label className="block text-[10px] uppercase tracking-wider text-pens-cream/40 mb-1">Draw date</label>
              <input
                type="date"
                required
                value={drawDate}
                onChange={e => setDrawDate(e.target.value)}
                className="bg-pens-deep border border-pens-muted/30 rounded-lg px-3 py-2 text-sm w-full md:w-44"
              />
            </div>
            <div className="flex-1 w-full min-w-[12rem]">
              <label className="block text-[10px] uppercase tracking-wider text-pens-cream/40 mb-1">Lab (optional)</label>
              <input
                type="text"
                value={labName}
                onChange={e => setLabName(e.target.value)}
                placeholder="e.g. Synlab"
                className="w-full bg-pens-deep border border-pens-muted/30 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-pens-cream/70 pb-2">
              <input type="checkbox" checked={fasting} onChange={e => setFasting(e.target.checked)} />
              Fasting draw
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-5 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create & edit markers →'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-pens-cream/50 mb-3">Panels</h2>
          {loading ? (
            <div className="h-32 rounded-xl bg-pens-surface/30 animate-pulse" />
          ) : panels.length === 0 ? (
            <p className="text-sm text-pens-cream/45">No panels yet — create one above.</p>
          ) : (
            <ul className="space-y-2">
              {panels.map(p => (
                <li key={p.id}>
                  <Link
                    href={`/bloodwork/${p.id}`}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl border border-pens-muted/20 bg-pens-surface/25 hover:border-rose-500/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-pens-cream">{p.drawDate}</p>
                      <p className="text-xs text-pens-cream/45">
                        {p.labName ?? 'No lab name'} · {p.markerCount} markers
                        {p.fasting ? ' · fasting' : ''}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-pens-cream/30 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
