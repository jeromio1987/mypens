'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronRight, Trash2, Loader2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface JournalEntry {
  id: string
  createdAt: string
  date: string
  title: string | null
  content: string
  mood: number | null
  notes: string | null
}

const MOOD_OPTIONS = [
  { v: 1, emoji: '😩', label: '1' },
  { v: 2, emoji: '😕', label: '2' },
  { v: 3, emoji: '😐', label: '3' },
  { v: 4, emoji: '🙂', label: '4' },
  { v: 5, emoji: '😄', label: '5' },
] as const

const inputCls =
  'w-full bg-pens-deep border border-pens-muted/40 rounded-xl px-3 py-2.5 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none focus:border-emerald-500/50'
const labelCls = 'block text-xs font-medium text-pens-cream/55 mb-1.5 uppercase tracking-wide'

export default function JournalPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/journal')
      const data = await r.json()
      if (Array.isArray(data)) setEntries(data)
      else setEntries([])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const history14 = useMemo(() => entries.slice(0, 14), [entries])

  const chartRows = useMemo(() => {
    const sorted = [...entries]
      .filter(e => e.mood != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map(e => ({
        label: new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        mood: e.mood as number,
        date: e.date,
      }))
    return sorted
  }, [entries])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!content.trim()) {
      setFormError('Write something today — content is required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          title: title.trim() || null,
          content: content.trim(),
          mood: mood === '' ? null : mood,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Save failed')
        return
      }
      await load()
      setContent('')
      setTitle('')
      setMood('')
      setNotes('')
    } catch {
      setFormError('Network error — try again.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setExpandedId(c => (c === id ? null : c))
    await load()
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/35">
                <BookOpen size={20} className="text-emerald-400" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">
                  P.E.N.S.
                </p>
                <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Journal</h1>
                <p className="text-xs text-emerald-400/80 mt-0.5">Daily entry · synced with mobile</p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-pens-gold hover:text-pens-cream transition-colors whitespace-nowrap"
          >
            Overview →
          </Link>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-pens-navy border border-pens-muted/30 p-5 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className={labelCls} htmlFor="journal-date">
                Date
              </label>
              <input
                id="journal-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={`${inputCls} w-auto min-w-[10rem]`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="journal-title">
              Title{' '}
              <span className="normal-case text-pens-cream/35 font-normal">(optional)</span>
            </label>
            <input
              id="journal-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Headline for the day"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="journal-content">
              Entry
            </label>
            <textarea
              id="journal-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Thoughts, events, reflections…"
              rows={6}
              className={`${inputCls} resize-y min-h-[140px]`}
            />
          </div>
          <div>
            <span className={labelCls}>Mood</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMood('')}
                className={`rounded-xl px-3 py-2 text-xs font-medium border transition-colors ${
                  mood === ''
                    ? 'bg-pens-deep border-emerald-500/60 text-emerald-300'
                    : 'bg-pens-deep/50 border-pens-muted/30 text-pens-cream/50 hover:border-pens-muted/50'
                }`}
              >
                Skip
              </button>
              {MOOD_OPTIONS.map(({ v, emoji, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMood(v)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm border transition-colors ${
                    mood === v
                      ? 'bg-emerald-500/20 border-emerald-500 text-pens-cream shadow-[0_0_16px_-4px_rgba(16,185,129,0.45)]'
                      : 'bg-pens-deep/50 border-pens-muted/30 text-pens-cream/80 hover:border-emerald-500/35'
                  }`}
                  aria-label={`Mood ${label}`}
                >
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="text-[10px] text-pens-cream/40">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="journal-notes">
              Notes{' '}
              <span className="normal-case text-pens-cream/35 font-normal">(optional)</span>
            </label>
            <textarea
              id="journal-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything else?"
              className={inputCls}
            />
          </div>
          {formError && (
            <p className="text-sm text-red-400 bg-pens-deep/80 rounded-xl px-3 py-2 border border-red-500/30">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Save today&apos;s entry
          </button>
        </form>

        <div className="rounded-2xl bg-pens-navy border border-pens-muted/30 p-5">
          <h2 className="text-sm font-semibold text-pens-cream mb-4 flex items-center gap-2">
            <span className="text-emerald-400">●</span> Mood trend (last 30 with mood logged)
          </h2>
          {chartRows.length === 0 ? (
            <p className="text-sm text-pens-cream/40">
              Pick a mood on a few days to see your line chart here.
            </p>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d405b" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    width={28}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1b263b',
                      border: '1px solid rgba(16,185,129,0.35)',
                      borderRadius: 12,
                      color: '#f5e6d3',
                    }}
                    formatter={value =>
                      [`${typeof value === 'number' ? value : (value ?? '—')}`, 'Mood']
                    }
                    labelFormatter={label => {
                      const row = typeof label === 'string' ? chartRows.find(r => r.label === label) : undefined
                      return row?.date ?? String(label ?? '')
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-pens-cream mb-3 uppercase tracking-widest">
            Recent entries
          </h2>
          {loading ? (
            <div className="rounded-2xl bg-pens-navy/60 border border-pens-muted/20 p-8 text-center text-pens-cream/40 text-sm animate-pulse">
              Loading journal…
            </div>
          ) : history14.length === 0 ? (
            <p className="text-sm text-pens-cream/45">Nothing yet — your first note goes above.</p>
          ) : (
            <ul className="space-y-3">
              {history14.map(e => {
                const open = expandedId === e.id
                return (
                  <li
                    key={e.id}
                    className="rounded-2xl bg-pens-navy border border-pens-muted/30 overflow-hidden shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : e.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-pens-deep/40 transition-colors"
                    >
                      {open ? (
                        <ChevronDown size={18} className="text-emerald-400 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-pens-cream/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-pens-cream/45 font-medium">
                          {new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="font-semibold text-pens-cream truncate">
                          {e.title?.trim() || 'Untitled entry'}
                        </p>
                      </div>
                      {e.mood != null && (
                        <span className="text-xl shrink-0" title={`Mood ${e.mood}`}>
                          {MOOD_OPTIONS[e.mood - 1]?.emoji ?? '—'}
                        </span>
                      )}
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-0 border-t border-pens-muted/20 bg-pens-deep/30">
                        <p className="text-sm text-pens-cream/90 whitespace-pre-wrap leading-relaxed mt-3">
                          {e.content}
                        </p>
                        {e.notes?.trim() ? (
                          <p className="text-xs text-pens-cream/50 mt-3 italic">{e.notes}</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => remove(e.id)}
                          className="mt-4 inline-flex items-center gap-2 text-xs text-red-400/90 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={14} />
                          Delete entry
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
