'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, X } from 'lucide-react'
import QuickToggle from '@/components/shared/QuickToggle'
import PresetPicker from '@/components/shared/PresetPicker'
import { today } from '@/lib/timeWindow'

interface Props {
  onSaved?: () => void
}

const FIELDS = [
  { key: 'waistCm', label: 'Waist', placeholder: '80', priority: true },
  { key: 'chestCm', label: 'Chest', placeholder: '100', priority: true },
  { key: 'hipsCm', label: 'Hips', placeholder: '95', priority: true },
  { key: 'leftArmCm', label: 'Left arm', placeholder: '35', priority: false },
  { key: 'rightArmCm', label: 'Right arm', placeholder: '35', priority: false },
  { key: 'leftThighCm', label: 'Left thigh', placeholder: '58', priority: false },
  { key: 'rightThighCm', label: 'Right thigh', placeholder: '58', priority: false },
  { key: 'neckCm', label: 'Neck', placeholder: '38', priority: false },
]

const inputCls = 'w-full bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none focus:border-pens-cream/30'
const labelCls = 'block text-sm font-medium text-pens-cream/80 mb-1'
const labelSmCls = 'block text-xs font-medium text-pens-cream/50 mb-1'

export default function MeasurementsEntry({ onSaved }: Props) {
  const todayStr = today()
  const [quick, setQuick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const blank = Object.fromEntries(FIELDS.map(f => [f.key, '']))
  const [form, setForm] = useState<Record<string, string>>({ date: todayStr, notes: '', ...blank })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (data: Record<string, unknown>) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      next[k] = v != null ? String(v) : ''
    }
    setForm(f => ({ ...f, ...next }))
  }

  const visibleFields = quick ? FIELDS.filter(f => f.priority) : FIELDS

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('date', form.date)
      const res = await fetch('/api/measurements/photo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Photo upload failed')
      setPhotoPath(data.photoPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const clearPhoto = () => setPhotoPath(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload: Record<string, unknown> = {
        date: form.date,
        notes: form.notes || undefined,
        photoPath: photoPath || undefined,
      }
      for (const f of FIELDS) {
        payload[f.key] = form[f.key] !== '' ? parseFloat(form[f.key]) : undefined
      }
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      onSaved?.()
      // Reset photo so the next entry doesn't reuse it; keep date/values for fast re-entry.
      setPhotoPath(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const presetValues = Object.fromEntries(FIELDS.map(f => [f.key, form[f.key]]).filter(([, v]) => v !== ''))

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold text-pens-cream">Log Measurements</h2>
        <QuickToggle quick={quick} onChange={setQuick} />
      </div>

      <div className="mb-4">
        <PresetPicker
          module="measurements"
          onApply={applyPreset}
          currentValues={Object.keys(presetValues).length > 0 ? presetValues : undefined}
          accentColor="bg-rose-600"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} required />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleFields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={labelSmCls}>{label} (cm)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className={inputCls}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>

        {!quick && (
          <div>
            <label className={labelSmCls}>Notes</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="optional" />
          </div>
        )}

        {/* Progress photo */}
        <div>
          <label className={labelSmCls}>Progress photo (optional)</label>
          {photoPath ? (
            <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-pens-muted/40 bg-pens-navy">
              <Image src={photoPath} alt="Progress photo" fill sizes="128px" className="object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                aria-label="Remove photo"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-pens-deep/80 text-pens-cream/80 hover:text-pens-cream flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-xs cursor-pointer transition-colors w-fit ${
                uploadingPhoto ? 'border-pens-muted/30 text-pens-cream/30 cursor-wait' : 'border-pens-muted/40 text-pens-cream/60 hover:border-pens-gold/60 hover:text-pens-cream'
              }`}
            >
              <Camera size={14} />
              {uploadingPhoto ? 'Uploading…' : 'Add photo (jpg / png / webp / heic)'}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="sr-only"
                disabled={uploadingPhoto}
                onChange={handlePhoto}
              />
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save measurements'}
        </button>
      </form>

      {saved && (
        <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          Saved ✓
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-pens-crimson/10 border border-pens-crimson/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
