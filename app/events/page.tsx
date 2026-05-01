'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plane, Thermometer, Palmtree, Salad, Trophy, Tag, Trash2, Plus } from 'lucide-react'

interface EventTag {
  id: string
  type: string
  label: string
  startDate: string
  endDate: string
  notes?: string | null
}

const EVENT_TYPES = [
  { value: 'travel',      label: 'Travel',      icon: Plane,       color: 'text-blue-300',    bg: 'bg-blue-900/30',    border: 'border-blue-700/40'    },
  { value: 'illness',     label: 'Illness',     icon: Thermometer, color: 'text-rose-300',    bg: 'bg-rose-900/30',    border: 'border-rose-700/40'    },
  { value: 'holiday',     label: 'Holiday',     icon: Palmtree,    color: 'text-emerald-300', bg: 'bg-emerald-900/30', border: 'border-emerald-700/40' },
  { value: 'diet-break',  label: 'Diet break',  icon: Salad,       color: 'text-pens-gold',   bg: 'bg-amber-900/30',   border: 'border-amber-700/40'   },
  { value: 'competition', label: 'Competition', icon: Trophy,      color: 'text-violet-300',  bg: 'bg-violet-900/30',  border: 'border-violet-700/40'  },
  { value: 'other',       label: 'Other',       icon: Tag,         color: 'text-pens-cream/70', bg: 'bg-pens-navy/50', border: 'border-pens-muted/30'  },
]

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getStatus(event: EventTag): 'active' | 'upcoming' | 'past' {
  const today = new Date().toISOString().split('T')[0]
  if (event.endDate < today) return 'past'
  if (event.startDate > today) return 'upcoming'
  return 'active'
}

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  upcoming: 'bg-blue-900/40    text-blue-300    border border-blue-700/40',
  past:     'bg-pens-navy/60   text-pens-cream/40 border border-pens-muted/30',
}

const inputCls = 'w-full bg-pens-navy/60 border border-pens-muted/30 focus:border-pens-gold/60 rounded-lg px-3 py-2 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none transition-colors'

export default function EventsPage() {
  const today = new Date().toISOString().split('T')[0]

  const [events, setEvents] = useState<EventTag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'travel',
    label: '',
    startDate: today,
    endDate: today,
    notes: '',
  })

  const load = () => {
    fetch('/api/events')
      .then(r => r.json())
      .then(setEvents)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setForm({ type: 'travel', label: '', startDate: today, endDate: today, notes: '' })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    load()
  }

  const getCfg = (type: string) => EVENT_TYPES.find(t => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1]

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
            <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Event Tags</h1>
            <p className="text-xs text-pens-cream/40 mt-0.5">Tag trips, illness, and other events to explain weight changes</p>
          </div>
        </div>

        <div className="bg-pens-surface/60 border border-pens-muted/20 rounded-xl p-3 text-xs text-pens-cream/60 leading-relaxed">
          Events appear as banners on your weight tracker and dashboard, helping you contextualise post-trip or post-illness scale spikes — they&apos;re informational, not adjustments.
        </div>

        {/* Add event form */}
        <section className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <h2 className="font-semibold text-pens-cream mb-4 flex items-center gap-2">
            <Plus size={16} className="text-pens-gold" />
            Add event
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div role="group" aria-labelledby="event-type-label">
              <p id="event-type-label" className="block text-xs uppercase tracking-widest text-pens-cream/50 font-semibold mb-2">Type</p>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_TYPES.map(({ value, label, icon: Icon, color, bg, border }) => {
                  const selected = form.type === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('type', value)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors ${
                        selected
                          ? `${bg} ${color} ${border}`
                          : 'bg-pens-navy/40 text-pens-cream/40 border-pens-muted/20 hover:border-pens-muted/50 hover:text-pens-cream/70'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="event-label" className="block text-xs uppercase tracking-widest text-pens-cream/50 font-semibold mb-1.5">Label</label>
              <input
                id="event-label"
                type="text"
                value={form.label}
                onChange={e => set('label', e.target.value)}
                placeholder="e.g. Amsterdam trip, Flu week"
                className={inputCls}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-start" className="block text-xs uppercase tracking-widest text-pens-cream/50 font-semibold mb-1.5">Start date</label>
                <input
                  id="event-start"
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label htmlFor="event-end" className="block text-xs uppercase tracking-widest text-pens-cream/50 font-semibold mb-1.5">End date</label>
                <input
                  id="event-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={e => set('endDate', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="event-notes" className="block text-xs uppercase tracking-widest text-pens-cream/50 font-semibold mb-1.5">
                Notes <span className="text-pens-cream/30 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="event-notes"
                type="text"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="e.g. Conference, ate out every day"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2 text-xs text-pens-cream">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-pens-cream text-pens-deep hover:bg-pens-cream/90 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm uppercase tracking-widest py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Add event'}
            </button>
          </form>
        </section>

        {/* Event list */}
        <section className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <h2 className="font-semibold text-pens-cream mb-4">Your events</h2>
          {loading && <p className="text-sm text-pens-cream/40">Loading…</p>}
          {!loading && events.length === 0 && (
            <p className="text-sm text-pens-cream/40">No events yet — add one above.</p>
          )}
          <div className="space-y-2">
            {events.map(event => {
              const cfg = getCfg(event.type)
              const Icon = cfg.icon
              const status = getStatus(event)

              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
                >
                  <Icon size={15} className={`${cfg.color} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${cfg.color}`}>{event.label}</p>
                      <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold ${STATUS_BADGE[status]}`}>
                        {status}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 opacity-70 ${cfg.color}`}>
                      {formatDate(event.startDate)}
                      {event.startDate !== event.endDate && ` – ${formatDate(event.endDate)}`}
                    </p>
                    {event.notes && (
                      <p className={`text-xs mt-0.5 opacity-60 ${cfg.color}`}>{event.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(event.id)}
                    className="text-pens-cream/30 hover:text-pens-crimson transition-colors shrink-0 mt-0.5"
                    aria-label="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
