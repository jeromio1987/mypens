'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Scale, Moon, Ruler, Sparkles, LayoutDashboard } from 'lucide-react'

const MODES = [
  {
    id: 'locked_in',
    label: 'Locked In',
    intent: 'Optimise',
    emoji: '🟢',
    activeBg: 'bg-emerald-900/60',
    activeBorder: 'border-emerald-500/60',
    activeText: 'text-emerald-300',
    idleBg: 'bg-pens-surface/40',
    idleBorder: 'border-pens-muted/20',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    intent: 'Maintain — covers social and flexible days',
    emoji: '🟡',
    activeBg: 'bg-yellow-900/50',
    activeBorder: 'border-yellow-500/50',
    activeText: 'text-yellow-300',
    idleBg: 'bg-pens-surface/40',
    idleBorder: 'border-pens-muted/20',
  },
  {
    id: 'off',
    label: 'Off',
    intent: 'Chaos + recovery — no friction',
    emoji: '🔴',
    activeBg: 'bg-red-900/40',
    activeBorder: 'border-pens-crimson/50',
    activeText: 'text-red-300',
    idleBg: 'bg-pens-surface/40',
    idleBorder: 'border-pens-muted/20',
  },
]

const CONTEXT_TAGS = [
  { id: 'alcohol',          label: 'Alcohol',         emoji: '🍷' },
  { id: 'heavy_meal',       label: 'Heavy meal',      emoji: '🍖' },
  { id: 'travel',           label: 'Travel',          emoji: '✈️' },
  { id: 'late_night',       label: 'Late night',      emoji: '🌙' },
  { id: 'intense_training', label: 'Hard training',   emoji: '💪' },
]

const MODULES = [
  { href: '/weight',       label: 'Weight',   icon: Scale    },
  { href: '/sleep',        label: 'Sleep',    icon: Moon     },
  { href: '/measurements', label: 'Body',     icon: Ruler    },
  { href: '/dashboard',    label: 'Overview', icon: LayoutDashboard },
]

interface DayEntry {
  mode: string | null
  tags: string[]
}

export default function Home() {
  const [entry, setEntry]       = useState<DayEntry>({ mode: null, tags: [] })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  useEffect(() => {
    fetch('/api/mode')
      .then(r => r.json())
      .then(d => setEntry({ mode: d.mode ?? null, tags: d.tags ?? [] }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectMode = async (modeId: string) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: modeId, tags: entry.tags }),
      })
      const d = await res.json()
      setEntry({ mode: d.mode, tags: d.tags ?? [] })
    } catch {}
    setSaving(false)
  }

  const toggleTag = async (tagId: string) => {
    if (!entry.mode) return
    const next = entry.tags.includes(tagId)
      ? entry.tags.filter(t => t !== tagId)
      : [...entry.tags, tagId]
    setEntry(e => ({ ...e, tags: next }))
    await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: entry.mode, tags: next }),
    })
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-10">
      <div className="max-w-sm mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
            <h1 className="text-3xl font-bold text-pens-cream mt-0.5">Today</h1>
            <p className="text-xs text-pens-muted mt-1">{today}</p>
          </div>
          <Link
            href="/clubroom"
            className="flex items-center gap-1.5 text-pens-gold hover:text-pens-cream transition-colors"
          >
            <Sparkles size={16} />
            <span className="text-xs font-medium">Clubroom</span>
          </Link>
        </div>

        {/* Mode selection */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-pens-muted font-semibold">
            {loading ? 'Loading…' : 'What mode are you in?'}
          </p>

          {MODES.map(m => {
            const active = entry.mode === m.id
            return (
              <button
                key={m.id}
                onClick={() => selectMode(m.id)}
                disabled={saving || loading}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-150 ${
                  active
                    ? `${m.activeBg} ${m.activeBorder} shadow-lg`
                    : `${m.idleBg} ${m.idleBorder} opacity-60 hover:opacity-90`
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl leading-none">{m.emoji}</span>
                  <div className="text-left">
                    <p className={`font-bold text-base ${active ? m.activeText : 'text-pens-cream'}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-pens-muted leading-tight mt-0.5">{m.intent}</p>
                  </div>
                </div>
                {active && (
                  <span className="text-[10px] text-pens-muted font-semibold uppercase tracking-wider shrink-0">
                    Today ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Context tags — shown once a mode is set */}
        {entry.mode && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-pens-muted font-semibold">
              Context <span className="normal-case tracking-normal font-normal">— optional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map(tag => {
                const active = entry.tags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      active
                        ? 'bg-pens-crimson/30 border-pens-crimson text-pens-cream'
                        : 'bg-pens-surface/60 border-pens-muted/30 text-pens-muted hover:text-pens-cream hover:border-pens-muted/60'
                    }`}
                  >
                    <span>{tag.emoji}</span>
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-pens-muted/20" />

        {/* Quick nav */}
        <div className="grid grid-cols-4 gap-3">
          {MODULES.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-pens-surface/40 hover:bg-pens-surface border border-pens-muted/20 transition-colors"
            >
              <Icon size={17} className="text-pens-muted" />
              <span className="text-[10px] font-medium text-pens-muted">{label}</span>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
