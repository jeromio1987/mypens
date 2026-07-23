'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadFocus, type FocusState } from '@/lib/pathways/focusStorage'
import { pathwayById, type PathwayId } from '@/lib/pathways/catalog'

type StrengthRow = { id: PathwayId; score: number }

/**
 * Thin Verdict strip — links to Dopamine workspace. No duplicate full card.
 */
export default function PathwayStatusChip() {
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [breakScore, setBreakScore] = useState<number | null>(null)
  const [buildScore, setBuildScore] = useState<number | null>(null)
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    const f = loadFocus()
    setFocus(f)
    fetch('/api/pathways')
      .then((r) => r.json())
      .then((j) => {
        setLinked(!!j.dataLinked)
        const rows = (j.pathways ?? []) as StrengthRow[]
        setBreakScore(rows.find((r) => r.id === f.breakId)?.score ?? null)
        setBuildScore(rows.find((r) => r.id === f.buildId)?.score ?? null)
      })
      .catch(() => {})
  }, [])

  if (!focus) return null
  const br = pathwayById(focus.breakId)
  const bu = pathwayById(focus.buildId)

  let status = 'Set focus on Dopamine'
  if (linked && breakScore != null && buildScore != null) {
    // Heuristic: break should trend lower is good; we only have snapshot — phrase gently
    status =
      breakScore > 65
        ? 'Break loop still loud — keep logging'
        : buildScore < 40
          ? 'Build loop still thin — protect reps'
          : 'Focus holding — stay the course'
  }

  return (
    <Link
      href="/dopamine"
      className="block rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3 hover:border-cyan-400/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-400/80 font-semibold">
            Pathways
          </p>
          <p className="text-sm text-pens-cream mt-0.5 truncate">
            {br?.short ?? '—'} · {bu?.short ?? '—'}
          </p>
          <p className="text-xs text-pens-cream/45 mt-1">{status}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-cyan-400/70">Open →</span>
      </div>
    </Link>
  )
}
