'use client'

// One-tap "I'm having a craving NOW" screen.
// Flow: open → 3-min cold-shower timer starts → log trigger + outcome → save → back.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const COLD_SHOWER_SECONDS = 180

const TARGETS = [
  { v: 'alcohol', label: 'Alcohol' },
  { v: 'cocaine', label: 'Cocaine' },
  { v: 'escort', label: 'Escort' },
  { v: 'other', label: 'Other' },
] as const

const ACTIONS = [
  { v: 'cold_shower', label: 'Cold shower' },
  { v: 'walk', label: 'Walk' },
  { v: 'training', label: 'Training' },
  { v: 'gaming', label: 'Gaming' },
  { v: 'breath', label: 'Breath work' },
  { v: 'other', label: 'Other' },
] as const

const OUTCOMES = [
  { v: 'resisted', label: 'Resisted' },
  { v: 'partial', label: 'Partial' },
  { v: 'slipped', label: 'Slipped' },
] as const

export default function CravingClient() {
  const router = useRouter()
  const [target, setTarget] = useState<string>('alcohol')
  const [action, setAction] = useState<string>('cold_shower')
  const [outcome, setOutcome] = useState<string>('resisted')
  const [trigger, setTrigger] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt] = useState<number>(Date.now()) // moment of opening
  const [secondsLeft, setSecondsLeft] = useState(COLD_SHOWER_SECONDS)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    if (!timerRunning) return
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, timerRunning])

  async function submit() {
    setSaving(true)
    try {
      const res = await fetch('/api/anchor/cravings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          action,
          outcome,
          trigger: trigger.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      router.replace('/anchor')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const elapsedMin = Math.floor((Date.now() - savedAt) / 60000)

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream font-[family-name:var(--font-geist-sans)] pb-24">
      <header className="px-5 pt-7 pb-3 flex items-center justify-between border-b border-pens-cream/10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-pens-crimson">
            Craving
          </div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-2xl font-bold leading-tight">
            You showed up.
          </h1>
        </div>
        <Link
          href="/anchor"
          className="text-[11px] uppercase tracking-[0.15em] text-pens-cream/60 hover:text-pens-cream"
        >
          Cancel
        </Link>
      </header>

      {/* COLD SHOWER TIMER — front and center */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-pens-surface/60 border border-pens-cream/10 p-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-pens-cream/60">
            3-minute cold shower
          </div>
          <div className="font-[family-name:var(--font-newsreader)] text-6xl font-bold mt-2 tabular-nums">
            {fmtTimer(secondsLeft)}
          </div>
          <div className="mt-3">
            {!timerRunning && secondsLeft === COLD_SHOWER_SECONDS && (
              <button
                onClick={() => setTimerRunning(true)}
                className="px-6 py-3 rounded-full bg-pens-gold text-pens-deep font-bold text-sm tracking-wide"
              >
                START — TURN IT COLD
              </button>
            )}
            {timerRunning && secondsLeft > 0 && (
              <div className="text-xs text-pens-cream/60">
                Stay in. Breathe through it. Don’t check the timer.
              </div>
            )}
            {secondsLeft === 0 && (
              <div className="text-pens-gold text-sm font-bold uppercase tracking-wider">
                Done. The craving is now ~60% smaller.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TARGET */}
      <section className="px-5 pt-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/60 mb-2">
          Craving for
        </div>
        <SegmentedRow options={TARGETS} value={target} onChange={setTarget} />
      </section>

      {/* WHAT YOU'RE DOING */}
      <section className="px-5 pt-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/60 mb-2">
          What I’m doing instead
        </div>
        <SegmentedRow options={ACTIONS} value={action} onChange={setAction} />
      </section>

      {/* TRIGGER */}
      <section className="px-5 pt-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/60 mb-2">
          Trigger
        </div>
        <input
          type="text"
          value={trigger}
          onChange={e => setTrigger(e.target.value)}
          placeholder="e.g. Friday 18:00 — work stress"
          className="w-full bg-pens-surface/40 border border-pens-cream/10 rounded-xl p-3 text-sm placeholder:text-pens-cream/30 focus:border-pens-cream/30 outline-none"
        />
      </section>

      {/* OUTCOME */}
      <section className="px-5 pt-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/60 mb-2">
          Outcome (be honest)
        </div>
        <SegmentedRow options={OUTCOMES} value={outcome} onChange={setOutcome} />
      </section>

      {/* NOTES */}
      <section className="px-5 pt-5">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional — anything you want to remember about this moment."
          className="w-full bg-pens-surface/40 border border-pens-cream/10 rounded-xl p-3 text-sm placeholder:text-pens-cream/30 focus:border-pens-cream/30 outline-none resize-none"
        />
      </section>

      <section className="px-5 pt-7">
        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-xl bg-pens-crimson text-pens-cream font-bold py-4 tracking-wide text-sm hover:bg-pens-crimson/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'LOG IT'}
        </button>
        <div className="text-[10px] text-pens-cream/40 text-center mt-2">
          Logged at{' '}
          {new Date(savedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {elapsedMin} min in this screen
        </div>
      </section>
    </main>
  )
}

function fmtTimer(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ v: T; label: string }>
  value: string
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={
              'px-3 py-2 rounded-full text-xs border transition-colors ' +
              (on
                ? 'bg-pens-cream text-pens-deep border-pens-cream'
                : 'border-pens-cream/20 text-pens-cream/70 hover:border-pens-cream/40')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
