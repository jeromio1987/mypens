'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bookmark, ChevronDown, Trash2, Plus } from 'lucide-react'

interface Preset {
  id: string
  name: string
  module: string
  data: string
  usedCount: number
}

interface Props {
  module: 'weight' | 'food' | 'sleep' | 'training' | 'measurements'
  onApply: (data: Record<string, unknown>) => void
  /** Current form values — passed in when user wants to save current as preset */
  currentValues?: Record<string, unknown>
  accentColor?: string // tailwind bg class e.g. 'bg-emerald-600'
}

export default function PresetPicker({
  module,
  onApply,
  currentValues,
  accentColor = 'bg-gray-600',
}: Props) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/presets?module=${module}`)
    if (res.ok) setPresets(await res.json())
  }, [module])

  useEffect(() => { load() }, [load])

  const applyPreset = async (preset: Preset) => {
    try {
      const data = JSON.parse(preset.data)
      onApply(data)
      setOpen(false)
      // increment usage count (fire and forget)
      fetch('/api/presets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: preset.id }) })
      setPresets(p => p.map(x => x.id === preset.id ? { ...x, usedCount: x.usedCount + 1 } : x))
    } catch {
      // malformed JSON — ignore
    }
  }

  const deletePreset = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch('/api/presets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPresets(p => p.filter(x => x.id !== id))
  }

  const savePreset = async () => {
    if (!saveName.trim() || !currentValues) return
    setSaving(true)
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, name: saveName.trim(), data: currentValues }),
      })
      if (res.ok) {
        await load()
        setSaveName('')
        setShowSaveForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Preset dropdown trigger */}
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setShowSaveForm(false) }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 transition-colors"
        >
          <Bookmark size={12} />
          Presets
          {presets.length > 0 && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 text-xs font-medium">{presets.length}</span>
          )}
          <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Save current as preset */}
        {currentValues && !showSaveForm && (
          <button
            type="button"
            onClick={() => { setShowSaveForm(true); setOpen(false) }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Plus size={12} />
            Save as preset
          </button>
        )}
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder="Preset name…"
            className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); savePreset() } if (e.key === 'Escape') setShowSaveForm(false) }}
            autoFocus
          />
          <button
            type="button"
            onClick={savePreset}
            disabled={!saveName.trim() || saving}
            className={`${accentColor} text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 transition-opacity`}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setShowSaveForm(false)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {presets.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400 text-center">No presets yet — fill a form and save it as preset</p>
          ) : (
            presets.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left group transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{preset.name}</p>
                  {preset.usedCount > 0 && (
                    <p className="text-xs text-gray-400">Used {preset.usedCount}×</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={e => deletePreset(e, preset.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 rounded transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
