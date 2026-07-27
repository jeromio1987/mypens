'use client'

import { useEffect, useState } from 'react'
import type { DailyTargets } from '@/lib/foodModels'
import type { BodyPhase } from '@/lib/bodyPhase'
import { Kicker } from '@/components/continental/kit'

const PHASES: BodyPhase[] = ['cut', 'bulk', 'recomp', 'maintain']

/** WP 2.3 — phase steers derived fueling targets. Continental chrome. */
export default function BodyPhaseCard({ onTargets }: { onTargets: (t: DailyTargets) => void }) {
  const [phase, setPhase] = useState<BodyPhase>('maintain')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [hrMax, setHrMax] = useState('')
  const [hrNote, setHrNote] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/body-phase')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j) return
        if (j.phase) setPhase(j.phase)
        if (j.targets) onTargets(j.targets)
        setNote(`Derived from phase ${j.phase} · ${j.kgPerWeek ?? 0.4} kg/wk`)
      })
      .catch(() => {})
    fetch('/api/settings')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j) return
        if (j.hrMax != null) setHrMax(String(j.hrMax))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [onTargets])

  const apply = async (next: BodyPhase) => {
    setBusy(true)
    setPhase(next)
    try {
      const r = await fetch('/api/body-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: next }),
      })
      const j = await r.json()
      if (j.targets) onTargets(j.targets)
      setNote(`Derived from phase ${j.phase} · ${j.kgPerWeek ?? 0.4} kg/wk`)
    } finally {
      setBusy(false)
    }
  }

  const saveHrMax = async () => {
    setBusy(true)
    setHrNote('')
    try {
      const trimmed = hrMax.trim()
      const payload =
        trimmed === ''
          ? { hrMax: null }
          : { hrMax: Math.round(Number(trimmed)) }
      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) {
        setHrNote(j.error || 'Save failed')
        return
      }
      setHrMax(j.hrMax != null ? String(j.hrMax) : '')
      setHrNote(j.hrMax != null ? `Saved · zones use ${j.hrMax}` : 'Cleared · default 185')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-ct-high p-5 space-y-4">
      <div>
        <Kicker>Body phase</Kicker>
        <p className="mt-2 text-sm text-ct-second/65 leading-relaxed">
          Cut / bulk / recomp changes kcal + protein targets and the week plan.
        </p>
      </div>
      <div className="flex flex-wrap gap-0">
        {PHASES.map(p => (
          <button
            key={p}
            type="button"
            disabled={busy}
            onClick={() => void apply(p)}
            className={`px-3 py-2.5 font-grotesk text-[0.625rem] uppercase tracking-[0.16em] transition-colors ${
              phase === p
                ? 'bg-ct-bloodc text-ct-blood'
                : 'bg-ct-highest text-ct-second/50 hover:text-ct-primary'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      {note ? (
        <p className="font-mono text-[0.5625rem] tracking-[0.04em] text-ct-second/40">↳ {note}</p>
      ) : null}

      <div className="border-t border-ct-highest pt-4 space-y-2">
        <Kicker>HRmax</Kicker>
        <p className="text-sm text-ct-second/65 leading-relaxed">
          Used for period-review training load zones. Leave blank for 185.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={120}
            max={230}
            inputMode="numeric"
            value={hrMax}
            onChange={e => setHrMax(e.target.value)}
            placeholder="185"
            className="w-24 bg-ct-highest px-3 py-2 font-mono text-sm text-ct-primary tabular-nums focus:outline-none"
          />
          <span className="font-grotesk text-[0.625rem] uppercase tracking-[0.14em] text-ct-second/45">
            bpm
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveHrMax()}
            className="ml-auto px-3 py-2 font-grotesk text-[0.625rem] uppercase tracking-[0.16em] bg-ct-bloodc text-ct-blood disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {hrNote ? (
          <p className="font-mono text-[0.5625rem] tracking-[0.04em] text-ct-second/40">↳ {hrNote}</p>
        ) : null}
      </div>
    </div>
  )
}
