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
  { value: 'travel',       label: 'Travel',       icon: Plane,        color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  { value: 'illness',      label: 'Illness',      icon: Thermometer,  color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  { value: 'holiday',      label: 'Holiday',      icon: Palmtree,     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { value: 'diet-break',   label: 'Diet break',   icon: Salad,        color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  { value: 'competition',  label: 'Competition',  icon: Trophy,       color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  { value: 'other',        label: 'Other',        icon: Tag,          color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200' },
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
  active:   'bg-emerald-100 text-emerald-700',
  upcoming: 'bg-blue-100 text-blue-700',
  past:     'bg-gray-100 text-gray-500',
}

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
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Event Tags</h1>
            <p className="text-sm text-gray-400 mt-0.5">Tag trips, illness, and other events to explain weight changes</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          Events appear as banners on your weight tracker and dashboard, helping you contextualise post-trip or post-illness scale spikes — they&apos;re informational, not adjustments.
        </div>

        {/* Add event form */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus size={16} className="text-gray-500" />
            Add event
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_TYPES.map(({ value, label, icon: Icon, color, bg, border }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('type', value)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-colors ${
                      form.type === value
                        ? `${bg} ${color} ${border}`
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={e => set('label', e.target.value)}
                placeholder="e.g. Amsterdam trip, Flu week"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={e => set('endDate', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="e.g. Conference, ate out every day"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Add event'}
            </button>
          </form>
        </div>

        {/* Event list */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Your events</h2>
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {!loading && events.length === 0 && (
            <p className="text-sm text-gray-400">No events yet — add one above.</p>
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
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[status]}`}>
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
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    aria-label="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
