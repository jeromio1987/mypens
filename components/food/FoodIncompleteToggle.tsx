'use client'

import { useEffect, useState } from 'react'

/** Soft flag: this calendar day’s food log is incomplete (late entry / partial). */
export default function FoodIncompleteToggle({
  date,
  refresh = 0,
  onChanged,
}: {
  date: string
  refresh?: number
  onChanged?: () => void
}) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/day-flags?date=${encodeURIComponent(date)}`)
        if (!res.ok) return
        const j = (await res.json()) as { foodIncomplete?: boolean }
        if (!cancelled) setOn(Boolean(j.foodIncomplete))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date, refresh])

  async function toggle() {
    const next = !on
    setBusy(true)
    setOn(next)
    try {
      const res = await fetch('/api/day-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, foodIncomplete: next }),
      })
      if (!res.ok) setOn(!next)
      else onChanged?.()
    } catch {
      setOn(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className={[
        'w-full text-left rounded-2xl px-4 py-3 border transition-colors',
        on
          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
          : 'bg-pens-surface border-pens-muted/30 text-pens-cream/70 hover:border-pens-muted/50',
      ].join(' ')}
    >
      <span className="text-[10px] uppercase tracking-widest font-semibold block mb-1">
        Day coverage
      </span>
      <span className="text-sm">
        {on
          ? 'Marked incomplete — energy ledger will flag this day (partial / late log).'
          : 'Mark food log incomplete for this date (forgotten meals still coming).'}
      </span>
    </button>
  )
}
