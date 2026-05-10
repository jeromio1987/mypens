'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Scale, Moon, Ruler, LayoutDashboard, Target, Scale as Balance, Bed, Info, ChevronRight, ListChecks, FileText, Anchor, BookOpen } from 'lucide-react'
import SyncStatusBadge from '@/components/shared/SyncStatusBadge'
import NotificationsBadge from '@/components/shared/NotificationsBadge'

const MODES = [
  {
    id: 'locked_in',
    label: 'Locked In',
    intent: 'High Intensity',
    description: 'Optimise — everything tracked, performance focus. The day is a sprint; distractions are obstacles.',
    accent: '#2e7d32',
    icon: Target,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    intent: 'Sustainable',
    description: 'Maintain — flexible day, social activity, no pressure. Sustainability over intensity. A respectable compromise.',
    accent: '#C9A84C',
    icon: Balance,
  },
  {
    id: 'off',
    label: 'Off',
    intent: 'Recovery',
    description: 'Rest or chaos — recovery or disruption, no friction. Surrender to the biological need for stillness.',
    accent: '#8B1E1E',
    icon: Bed,
  },
] as const

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
  { href: '/anchor',       label: 'Anchor',   icon: Anchor },
  { href: '/measurements', label: 'Body',     icon: Ruler },
  { href: '/dashboard',    label: 'Overview', icon: LayoutDashboard },
  { href: '/journal',      label: 'Journal',  icon: BookOpen, emeraldNav: true },
] as const

interface DayEntry {
  mode: string | null
  tags: string[]
  streak: number
}

export default function HomeClient() {
  const [entry, setEntry]     = useState<DayEntry>({ mode: null, tags: [], streak: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [stamp, setStamp]     = useState<{ today: string; time: string; entryNumber: number | null }>(
    { today: '', time: '', entryNumber: null },
  )

  useEffect(() => {
    // Deferred to client to avoid SSR/CSR locale + timezone hydration mismatches.
    const now = new Date()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStamp({
      today: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time:  now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      entryNumber: Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000),
    })
  }, [])

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

  const primaryMode = MODES[0]
  const secondaryModes = MODES.slice(1)

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-pens-deep/95 backdrop-blur border-b border-pens-muted/20">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pens-crimson/20 border border-pens-crimson/40 flex items-center justify-center">
              <span className="font-[family-name:var(--font-headline)] font-black italic text-pens-cream">A</span>
            </div>
            <h1 className="text-xl font-[family-name:var(--font-headline)] font-black italic text-pens-cream">Auditor</h1>
          </div>
          <nav className="hidden md:flex gap-8">
            <Link href="/landing"    className="uppercase tracking-widest text-xs font-bold text-pens-cream/60 hover:text-pens-cream transition-colors">About</Link>
            <Link href="/dashboard" className="uppercase tracking-widest text-xs font-bold text-pens-cream/60 hover:text-pens-cream transition-colors">Dashboard</Link>
            <Link href="/context"   className="uppercase tracking-widest text-xs font-bold text-pens-cream/60 hover:text-pens-cream transition-colors">Journal</Link>
            <span             className="uppercase tracking-widest text-xs font-bold text-pens-crimson">Modes</span>
            <Link href="/anchor"    className="uppercase tracking-widest text-xs font-bold text-pens-cream/60 hover:text-pens-cream transition-colors">Anchor</Link>
            <Link href="/data"      className="uppercase tracking-widest text-xs font-bold text-pens-cream/60 hover:text-pens-cream transition-colors">Vault</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 pt-12 pb-32">
        {/* Editorial header */}
        <header className="mb-12 max-w-2xl">
          <div className="flex items-baseline gap-4 mb-2 flex-wrap min-h-[1rem]">
            {stamp.entryNumber !== null && (
              <>
                <span className="text-xs font-bold tracking-[0.2em] text-pens-crimson uppercase">Entry {stamp.entryNumber}</span>
                <span className="text-xs font-medium text-pens-cream/40">{stamp.today} — {stamp.time}</span>
              </>
            )}
          </div>
          <h2 className="text-5xl md:text-7xl font-[family-name:var(--font-headline)] font-bold italic tracking-tight text-pens-cream leading-tight">
            Today&apos;s Intent
          </h2>
          <p className="mt-6 text-lg text-pens-cream/60 font-light leading-relaxed">
            Before the chaos of the world intervenes, define the scope of your output. Choose a frequency and commit to the ledger.
          </p>
        </header>

        <div className="space-y-2">
          <SyncStatusBadge />
          <NotificationsBadge />
        </div>

        {/* Quick nav: Mode / Context / Verdict */}
        <div className="flex items-center gap-2 mb-12 mt-6 max-w-xl">
          <div className="flex items-center gap-1.5 flex-1 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2.5">
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

        {/* Asymmetric mode selection */}
        {loading ? (
          <div className="h-96 rounded-2xl bg-pens-surface/30 animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mb-16">
            {/* Primary mode */}
            <div className="md:col-span-6 lg:col-span-5 h-full">
              <button
                onClick={() => selectMode(primaryMode.id)}
                disabled={saving}
                className={`w-full text-left group relative p-8 md:p-12 rounded-xl transition-all hover:scale-[1.01] active:scale-95 flex flex-col justify-between min-h-[420px] border-b-4 ${
                  entry.mode === primaryMode.id
                    ? 'bg-pens-surface shadow-[0_30px_60px_rgba(0,0,0,0.4)]'
                    : 'bg-pens-surface/40 hover:bg-pens-surface/60'
                }`}
                style={{ borderBottomColor: primaryMode.accent }}
              >
                <div className="absolute top-8 right-8 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: primaryMode.accent, boxShadow: entry.mode === primaryMode.id ? `0 0 12px ${primaryMode.accent}` : 'none' }}
                  />
                  <span className="text-[10px] font-bold tracking-widest text-pens-cream/50 uppercase">{primaryMode.intent}</span>
                </div>
                <div>
                  <primaryMode.icon size={36} className="text-pens-cream mb-6" />
                  <h3 className="text-4xl font-[family-name:var(--font-headline)] font-bold italic text-pens-cream mb-4">
                    {primaryMode.label}
                  </h3>
                  <p className="text-pens-cream/60 leading-relaxed max-w-xs">{primaryMode.description}</p>
                </div>
                <div className="mt-auto pt-12 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-pens-cream/40">P.E.N.S. Priority</p>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-1" style={{ backgroundColor: primaryMode.accent }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-pens-crimson uppercase border-b-2 border-pens-crimson/30 group-hover:border-pens-crimson transition-colors">
                    {entry.mode === primaryMode.id ? 'Active ✓' : 'Select State'}
                  </span>
                </div>
              </button>
            </div>

            {/* Secondary modes */}
            <div className="md:col-span-6 lg:col-span-7 grid grid-cols-1 gap-6">
              {secondaryModes.map(m => {
                const active = entry.mode === m.id
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => selectMode(m.id)}
                    disabled={saving}
                    className={`w-full text-left group p-8 rounded-xl transition-all hover:scale-[1.01] active:scale-95 flex items-center gap-8 border-b-4 ${
                      active ? 'bg-pens-surface shadow-[0_20px_40px_rgba(0,0,0,0.3)]' : 'bg-pens-surface/40 hover:bg-pens-surface/60'
                    }`}
                    style={{ borderBottomColor: m.accent }}
                  >
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-pens-deep/60 flex items-center justify-center border border-pens-muted/20">
                      <Icon size={28} className="text-pens-cream" />
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-[family-name:var(--font-headline)] font-bold italic text-pens-cream">{m.label}</h3>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.accent }} />
                        {active && <span className="text-[9px] uppercase tracking-widest text-pens-cream/50 ml-2">Active</span>}
                      </div>
                      <p className="text-sm text-pens-cream/60 max-w-md">{m.description}</p>
                    </div>
                    <ChevronRight size={20} className="text-pens-cream/30 group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                )
              })}

              {/* Auditor's Note */}
              <div className="mt-4 p-8 bg-pens-navy text-pens-cream rounded-xl border border-pens-muted/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,30,30,0.1),transparent_60%)]" />
                <div className="relative flex items-start gap-4">
                  <Info size={20} className="text-pens-crimson shrink-0 mt-1" />
                  <div>
                    <h4 className="font-[family-name:var(--font-headline)] italic font-bold text-xl mb-2">The Auditor&apos;s Note</h4>
                    <p className="text-sm opacity-70 leading-relaxed">
                      Indecision is the silent killer of performance. If you cannot decide, you have already chosen &lsquo;Off&rsquo;. We track for clarity, not for punishment. Proceed with intent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Context tags — shown once a mode is set */}
        {entry.mode && (
          <div className="space-y-3 mb-16 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-pens-cream/50 font-bold">
                Context <span className="normal-case tracking-normal font-normal text-pens-cream/30">— optional</span>
              </p>
              <Link
                href="/context"
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-pens-cream/40 hover:text-pens-cream transition-colors font-medium"
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
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all border ${
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

        {/* Footer ledger row */}
        <div className="mt-24 border-t-2 border-pens-muted/20 pt-8 flex flex-col md:flex-row justify-between gap-8">
          <div className="flex items-center gap-12">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-pens-cream/40 mb-1">Current Streak</p>
              <p className="text-3xl font-[family-name:var(--font-headline)] italic font-bold text-pens-cream">
                {entry.streak} {entry.streak === 1 ? 'Day' : 'Days'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-pens-cream/40 mb-1">Mental Load</p>
              <p className="text-3xl font-[family-name:var(--font-headline)] italic font-bold text-pens-cream">
                {entry.mode === 'locked_in' ? 'High' : entry.mode === 'balanced' ? 'Moderate' : entry.mode === 'off' ? 'Low' : '—'}
              </p>
            </div>
          </div>
          <div className="max-w-xs md:text-right">
            <p className="text-[10px] leading-relaxed font-medium text-pens-cream/40 italic">
              &ldquo;The difference between a gentleman and a vagabond is a schedule.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Bottom mobile nav (preserved) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-pens-deep/95 backdrop-blur border-t border-pens-muted/20 md:hidden z-40">
        <div className="max-w-lg mx-auto grid grid-cols-3 sm:grid-cols-6">
          {MODULES.map(({ href, label, icon: Icon, ...rest }) => {
            const emerald = 'emeraldNav' in rest && rest.emeraldNav
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                  emerald ? 'text-emerald-500 hover:text-emerald-400' : 'text-pens-cream/40 hover:text-pens-cream'
                }`}
              >
                <Icon size={18} />
                <span className="text-[9px] uppercase tracking-widest font-medium text-center leading-tight px-0.5">
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </main>
  )
}
