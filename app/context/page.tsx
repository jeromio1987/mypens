'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Scale, Moon, BookOpen, LayoutDashboard,
  Droplets, Utensils, Plane, Dumbbell,
  ArrowLeft, Check, BarChart2, ListChecks, FileText, UtensilsCrossed,
} from 'lucide-react'

const CONTEXT_TAGS = [
  { id: 'alcohol',          label: 'Alcohol',       icon: Droplets  },
  { id: 'heavy_meal',       label: 'Heavy meal',    icon: Utensils  },
  { id: 'travel',           label: 'Travel',        icon: Plane     },
  { id: 'late_night',       label: 'Late night',    icon: Moon      },
  { id: 'intense_training', label: 'Hard training', icon: Dumbbell  },
]

interface QuickEntry {
  href: string
  label: string
  icon: React.ElementType
  action: string
  subtitle: string
}

const QUICK_ENTRIES: QuickEntry[] = [
  { href: '/weight',       label: 'Weight',   icon: Scale,           action: 'RECORD', subtitle: 'Last entry' },
  { href: '/food',         label: 'Food',     icon: UtensilsCrossed, action: 'RECORD', subtitle: 'Macros & photo AI' },
  { href: '/sleep',        label: 'Sleep',    icon: Moon,            action: 'AUDIT',  subtitle: 'Last entry' },
  { href: '/journal',      label: 'Journal',  icon: BookOpen,        action: 'OPEN',   subtitle: 'Mood ledger & reflections' },
  { href: '/dashboard',    label: 'Overview', icon: LayoutDashboard, action: 'VIEW',   subtitle: "The Day's P.E.N.S. Score" },
]

interface DayState {
  mode: string | null
  tags: string[]
}

interface LastEntries {
  weight: string | null
  sleep: string | null
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

export default function ContextPage() {
  const router = useRouter()
  const [day, setDay]         = useState<DayState>({ mode: null, tags: [] })
  const [last, setLast]       = useState<LastEntries>({ weight: null, sleep: null })
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [modeRes, dashRes] = await Promise.all([
          fetch('/api/mode'),
          fetch('/api/dashboard'),
        ])
        const modeData = await modeRes.json()
        const dashData = await dashRes.json()

        setDay({ mode: modeData.mode ?? null, tags: modeData.tags ?? [] })

        const w = dashData?.weight?.latest
        const s = dashData?.sleep?.latest

        setLast({
          weight: w ? `${w.scaleKg} kg` : null,
          sleep:  s ? formatHours(s.hours) : null,
        })
      } catch {}
      setLoading(false)
    }
    loadData()
  }, [])

  const toggleTag = async (tagId: string) => {
    const next = day.tags.includes(tagId)
      ? day.tags.filter(t => t !== tagId)
      : [...day.tags, tagId]
    setDay(d => ({ ...d, tags: next }))
    if (day.mode) {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: day.mode, tags: next }),
      })
    }
  }

  const submitEntry = async () => {
    if (saving || !day.mode) return
    setSaving(true)
    try {
      await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: day.mode, tags: day.tags }),
      })
      setSubmitted(true)
      setTimeout(() => router.push('/dashboard'), 900)
    } catch {}
    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-pens-deep">
      <div className="max-w-sm mx-auto px-4 pt-8 pb-28 space-y-8">

        {/* Back nav */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-pens-cream/30 hover:text-pens-cream/60 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-medium">P.E.N.S.</p>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold italic text-pens-cream leading-tight mb-3">
            The Day&apos;s<br />Context
          </h1>
          <p className="text-sm text-pens-cream/50 leading-relaxed">
            Document the variables that define your performance today. No judgment, only data.
          </p>
        </div>

        {/* Today's Flow — page nav */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 flex-1 bg-pens-surface/60 border border-pens-muted/20 hover:border-pens-muted/40 rounded-xl px-3 py-2.5 transition-colors"
          >
            <BarChart2 size={13} className="text-pens-cream/40 shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-cream/30 font-semibold leading-none mb-0.5">Today</p>
              <p className="text-xs font-bold text-pens-cream/60 truncate">Mode</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 flex-1 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2.5">
            <ListChecks size={13} className="text-pens-crimson shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-crimson/70 font-semibold leading-none mb-0.5">Log</p>
              <p className="text-xs font-bold text-pens-cream truncate">Context</p>
            </div>
          </div>
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

        {/* Context tag grid */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {CONTEXT_TAGS.map(tag => {
              const active = day.tags.includes(tag.id)
              const Icon   = tag.icon
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`text-left p-4 rounded-2xl border transition-all duration-150 ${
                    active
                      ? 'bg-pens-crimson/15 border-pens-crimson/40'
                      : 'bg-pens-surface/50 border-pens-muted/20 hover:border-pens-muted/40'
                  }`}
                >
                  <Icon
                    size={22}
                    className={`mb-3 ${active ? 'text-pens-crimson' : 'text-pens-cream/30'}`}
                  />
                  <p className="text-[9px] uppercase tracking-widest text-pens-cream/30 font-medium mb-0.5">
                    Context Tags
                  </p>
                  <p className={`text-base font-bold italic leading-tight ${active ? 'text-pens-cream' : 'text-pens-cream/60'}`}>
                    {tag.label}
                  </p>
                </button>
              )
            })}
          </div>
          {!day.mode && !loading && (
            <p className="text-xs text-pens-cream/30 text-center">
              Select a mode on the home screen to save context tags
            </p>
          )}
        </div>

        {/* Quick access entries */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold">
            Quick Access Entries
          </p>
          <div className="space-y-2">
            {QUICK_ENTRIES.map(entry => {
              const Icon = entry.icon
              const subtitle =
                entry.label === 'Weight' && last.weight ? `Last entry: ${last.weight}` :
                entry.label === 'Sleep'  && last.sleep  ? `Last entry: ${last.sleep}` :
                entry.subtitle

              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-pens-surface/50 border border-pens-muted/20 hover:border-pens-muted/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-pens-deep flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-pens-cream/50 group-hover:text-pens-cream/80 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-pens-cream leading-tight">{entry.label}</p>
                    <p className="text-xs text-pens-cream/40 mt-0.5 truncate">{subtitle}</p>
                  </div>
                  <span className="text-[10px] font-bold tracking-widest px-3 py-1.5 rounded-lg bg-pens-crimson text-white shrink-0">
                    {entry.action}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Finalize Your Report */}
        <div className="bg-gradient-to-br from-pens-surface to-pens-navy border border-pens-muted/20 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold italic text-pens-cream leading-snug mb-2">
              Finalize Your<br />Report
            </h2>
            <p className="text-sm text-pens-cream/50 leading-relaxed mb-6">
              Once the context is set, we audit your performance against the week&apos;s baseline.
            </p>
            <button
              onClick={submitEntry}
              disabled={saving || !day.mode || submitted}
              className={`w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${
                submitted
                  ? 'bg-emerald-700 text-white'
                  : day.mode
                  ? 'bg-pens-cream text-pens-deep hover:bg-pens-cream/90 active:scale-[0.98]'
                  : 'bg-pens-muted/20 text-pens-cream/30 cursor-not-allowed'
              }`}
            >
              {submitted ? (
                <span className="flex items-center justify-center gap-2">
                  <Check size={15} /> Saved — heading to overview
                </span>
              ) : (
                'Submit Entry'
              )}
            </button>
            {!day.mode && (
              <p className="text-center text-xs text-pens-cream/20 mt-3">
                Select a mode first →{' '}
                <Link href="/" className="text-pens-cream/40 hover:text-pens-cream underline">Home</Link>
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-pens-deep/95 backdrop-blur border-t border-pens-muted/20">
        <div className="max-w-sm mx-auto grid grid-cols-5">
          {[
            { href: '/weight',       label: 'Weight',   icon: Scale },
            { href: '/food',         label: 'Food',     icon: UtensilsCrossed },
            { href: '/sleep',        label: 'Sleep',    icon: Moon },
            { href: '/journal',      label: 'Journal',  icon: BookOpen },
            { href: '/dashboard',    label: 'Overview', icon: LayoutDashboard },
          ].map(({ href, label, icon: Icon }) => (
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
