'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Scale, Moon, Ruler, LayoutDashboard, ArrowUpRight, Plus, ListChecks, FileText, BarChart2 } from 'lucide-react'
import SyncStatusBadge from '@/components/shared/SyncStatusBadge'

const MODES = [
  {
    id: 'locked_in',
    label: 'Locked In',
    description: 'Maximum performance focus. No deviations. No excuses. The P.E.N.S. protocol is absolute today.',
    priority: 'PERFORMANCE',
    priorityColor: 'text-pens-crimson',
    icon: '↗',
    activeBorder: 'border-l-4 border-l-pens-crimson',
    activeBg: 'bg-gradient-to-br from-pens-surface to-pens-navy',
    idleBg: 'bg-pens-surface/50',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Maintenance mode. Respect the foundations of movement and sleep, but allow room for the unexpected.',
    priority: 'SUSTAINABILITY',
    priorityColor: 'text-pens-gold',
    icon: '⚖',
    activeBorder: 'border-l-4 border-l-pens-gold',
    activeBg: 'bg-gradient-to-br from-pens-surface to-pens-navy',
    idleBg: 'bg-pens-surface/50',
  },
  {
    id: 'off',
    label: 'Off',
    description: 'Total rest or calculated chaos. Recovery is a weapon, use it wisely.',
    priority: 'RECOVERY',
    priorityColor: 'text-pens-cream/40',
    icon: '○',
    activeBorder: 'border-l-4 border-l-pens-muted',
    activeBg: 'bg-gradient-to-br from-pens-surface to-pens-navy',
    idleBg: 'bg-pens-surface/50',
  },
]

const CONTEXT_TAGS = [
  { id: 'alcohol',          label: 'Alcohol',       emoji: '🍷' },
  { id: 'heavy_meal',       label: 'Heavy meal',    emoji: '🍖' },
  { id: 'travel',           label: 'Travel',        emoji: '✈️' },
  { id: 'late_night',       label: 'Late night',    emoji: '🌙' },
  { id: 'intense_training', label: 'Hard training', emoji: '💪' },
]

const MODULES = [
  { href: '/weight',       label: 'Weight',   icon: Scale },
  { href: '/sleep',        label: 'Sleep',    icon: Moon },
  { href: '/measurements', label: 'Body',     icon: Ruler },
  { href: '/dashboard',    label: 'Overview', icon: LayoutDashboard },
]

interface DayEntry {
  mode: string | null
  tags: string[]
  streak: number
}

export default function Home() {
  const [entry, setEntry]     = useState<DayEntry>({ mode: null, tags: [], streak: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  useEffect(() => {
    fetch('/api/mode')
      .then(r => r.json())
      .then(d => setEntry({ mode: d.mode ?? null, tags: d.tags ?? [], streak: d.streak ?? 0 }))
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
      setEntry({ mode: d.mode, tags: d.tags ?? [], streak: d.streak ?? entry.streak })
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

  const activeMode = MODES.find(m => m.id === entry.mode)

  return (
    <main className="min-h-screen bg-pens-deep">
      <div className="max-w-sm mx-auto px-4 pt-10 pb-28 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold mb-1">P.E.N.S.</p>
            <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-medium mb-0.5">
              Today&apos;s Intent
            </p>
            <h1 className="text-4xl font-bold text-pens-cream leading-tight">
              Mode<br />Selection.
            </h1>
            <p className="text-xs text-pens-cream/30 mt-2">{today}</p>
          </div>

          {/* Streak badge */}
          {entry.streak > 0 && (
            <div className="text-right mt-1">
              <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 mb-1">Current Streak</p>
              <div className="bg-pens-crimson/20 border border-pens-crimson/40 rounded-xl px-4 py-2 text-center">
                <p className="text-2xl font-bold text-pens-cream leading-none">{entry.streak}</p>
                <p className="text-[10px] text-pens-cream/50 mt-0.5">Days</p>
              </div>
            </div>
          )}
        </div>

        {/* Integration sync failure badge */}
        <SyncStatusBadge />

        {/* Today's Flow — quick-nav between the 3 main pages */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2.5">
            <BarChart2 size={13} className="text-pens-crimson shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-crimson/70 font-semibold leading-none mb-0.5">Today</p>
              <p className="text-xs font-bold text-pens-cream truncate">Mode</p>
            </div>
          </div>
          <Link
            href="/context"
            className="flex items-center gap-1.5 flex-1 bg-pens-surface/60 border border-pens-muted/20 hover:border-pens-muted/40 rounded-xl px-3 py-2.5 transition-colors"
          >
            <ListChecks size={13} className="text-pens-cream/40 shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-cream/30 font-semibold leading-none mb-0.5">Log</p>
              <p className="text-xs font-bold text-pens-cream/60 truncate">Context</p>
            </div>
          </Link>
          <Link
            href="/verdict"
            className="flex items-center gap-1.5 flex-1 bg-pens-surface/60 border border-pens-muted/20 hover:border-pens-muted/40 rounded-xl px-3 py-2.5 transition-colors"
          >
            <FileText size={13} className="text-pens-cream/40 shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-cream/30 font-semibold leading-none mb-0.5">Review</p>
              <p className="text-xs font-bold text-pens-cream/60 truncate">Verdict</p>
            </div>
          </Link>
        </div>

        {/* Mode cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="h-40 rounded-2xl bg-pens-surface/30 animate-pulse" />
          ) : (
            MODES.map(m => {
              const active = entry.mode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => selectMode(m.id)}
                  disabled={saving}
                  className={`w-full text-left rounded-2xl border border-pens-muted/20 overflow-hidden transition-all duration-200 ${
                    active
                      ? `${m.activeBg} ${m.activeBorder} shadow-lg shadow-black/30`
                      : `${m.idleBg} opacity-70 hover:opacity-90`
                  }`}
                >
                  {/* Card inner */}
                  <div className="relative px-5 py-5 min-h-[140px] flex flex-col justify-between">
                    {/* Watermark for "Off" */}
                    {m.id === 'off' && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl font-black text-pens-muted/10 tracking-widest select-none pointer-events-none">
                        REST
                      </span>
                    )}

                    <div>
                      {/* Icon + title row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-light ${active ? m.priorityColor : 'text-pens-cream/30'}`}>
                            {m.icon}
                          </span>
                          <h2 className="text-xl font-bold text-pens-cream">{m.label}</h2>
                        </div>
                        {active
                          ? <ArrowUpRight size={16} className="text-pens-cream/40 shrink-0 mt-0.5" />
                          : <Plus size={16} className="text-pens-cream/20 shrink-0 mt-0.5" />
                        }
                      </div>

                      {/* Description */}
                      <p className="text-sm text-pens-cream/60 leading-relaxed pr-6">
                        {m.description}
                      </p>
                    </div>

                    {/* Priority label */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-pens-muted/20">
                      <p className={`text-[10px] uppercase tracking-widest font-semibold ${active ? m.priorityColor : 'text-pens-cream/20'}`}>
                        Priority: {m.priority}
                      </p>
                      {active && (
                        <span className="text-[10px] text-pens-cream/30 uppercase tracking-wider">
                          Active ✓
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Context tags — shown once a mode is set */}
        {entry.mode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold">
                Context <span className="normal-case tracking-normal font-normal text-pens-cream/20">— optional</span>
              </p>
              <Link
                href="/context"
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-pens-cream/30 hover:text-pens-cream/60 transition-colors font-medium"
              >
                <ListChecks size={12} />
                Full report
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map(tag => {
                const active = entry.tags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      active
                        ? 'bg-pens-crimson/20 border-pens-crimson/50 text-pens-cream'
                        : 'bg-pens-surface/40 border-pens-muted/20 text-pens-cream/40 hover:text-pens-cream/70 hover:border-pens-muted/40'
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

        {/* Auditor's Note */}
        <div className="space-y-4">
          <div className="border-t border-pens-muted/20 pt-6">
            <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold mb-5">
              Auditor&apos;s Note
            </p>
            <blockquote className="italic text-pens-cream/80 text-lg leading-relaxed font-serif">
              &ldquo;A man without a plan is just a tourist in his own life. Pick your lane. Whether you&apos;re hunting records or catching sleep, do it with intent.&rdquo;
            </blockquote>
            <p className="text-[10px] uppercase tracking-widest text-pens-cream/20 mt-4 font-medium">
              — Today Morning Review
            </p>
          </div>
        </div>

        {/* Why Mode Matters */}
        <div className="bg-pens-surface/50 border border-pens-muted/20 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-pens-cream">Why Mode Matters?</h3>
          <p className="text-sm text-pens-cream/60 leading-relaxed">
            Willpower is a finite resource. By selecting your mode now, you remove the decision fatigue of the day. Performance mode activates high-precision tracking, while Balanced keeps the streak alive without the mental overhead.
          </p>
          <div className="flex gap-2 pt-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full bg-pens-crimson/15 text-pens-crimson border border-pens-crimson/20">
              Promise
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full bg-pens-muted/20 text-pens-cream/40 border border-pens-muted/20">
              Premise
            </span>
          </div>
        </div>

      </div>

      {/* Bottom nav — fixed */}
      <nav className="fixed bottom-0 left-0 right-0 bg-pens-deep/95 backdrop-blur border-t border-pens-muted/20">
        <div className="max-w-sm mx-auto grid grid-cols-4">
          {MODULES.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-4 text-pens-cream/30 hover:text-pens-cream/70 transition-colors"
            >
              <Icon size={18} />
              <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
