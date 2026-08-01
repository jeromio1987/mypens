'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { rollingWindow } from '@/lib/timeWindow'

type TheRead = {
  verdict: 'good' | 'mixed' | 'bad' | null
  headline: string
  leadingCause: { label: string; confidence: number } | null
  nextAction: string
  avgForm: number | null
}

type LabsChip = {
  present: boolean
  chipLabel: string
  panelId: string | null
  drawDate: string | null
  flaggedCount: number
}

/** Compact Read strip for web home (WP 0.7) — same API as mobile EngineReadCard. */
export default function HomeReadCard() {
  const [read, setRead] = useState<TheRead | null>(null)
  const [labs, setLabs] = useState<LabsChip | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const dateWindow = rollingWindow(14)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const timer = globalThis.setTimeout(() => ac.abort(), 25_000)
    setLoading(true)
    setErr(null)
    Promise.all([
      fetch(
        `/api/period-review?from=${encodeURIComponent(dateWindow.from)}&to=${encodeURIComponent(dateWindow.to)}`,
        { signal: ac.signal },
      ).then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        return j
      }),
      fetch('/api/bloodwork/latest-summary')
        .then(async r => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([j, labsJson]) => {
        if (cancelled) return
        const tr = j?.cockpit?.theRead
        if (!tr) {
          setRead(null)
        } else {
          setRead({
            verdict: tr.verdict ?? null,
            headline: tr.headline ?? 'No read yet for this window.',
            leadingCause: tr.leadingCause ?? null,
            nextAction: tr.nextAction ?? '',
            avgForm: tr.avgForm ?? null,
          })
        }
        if (labsJson?.present) {
          setLabs({
            present: true,
            chipLabel: labsJson.chipLabel,
            panelId: labsJson.panelId ?? null,
            drawDate: labsJson.drawDate ?? null,
            flaggedCount: labsJson.flaggedCount ?? 0,
          })
        } else {
          setLabs(null)
        }
      })
      .catch(e => {
        if (cancelled) return
        if (e instanceof DOMException && e.name === 'AbortError') {
          setErr('Timed out loading Read (remote DB).')
        } else {
          setErr(e instanceof Error ? e.message : 'failed')
        }
      })
      .finally(() => {
        globalThis.clearTimeout(timer)
        // Always clear — do not gate on cancelled (Strict Mode remount trap).
        setLoading(false)
      })
    return () => {
      cancelled = true
      globalThis.clearTimeout(timer)
      // Do not abort in-flight fetch — abort+cancelled-skip-loading = eternal skeleton.
    }
  }, [dateWindow.from, dateWindow.to])
  const tone =
    read?.verdict === 'good'
      ? 'border-emerald-500/30 bg-emerald-950/20'
      : read?.verdict === 'bad'
        ? 'border-pens-crimson/40 bg-pens-crimson/10'
        : read?.verdict === 'mixed'
          ? 'border-amber-500/30 bg-amber-950/20'
          : 'border-pens-muted/25 bg-pens-surface/60'

  const labsHref = labs?.panelId ? `/bloodwork/${labs.panelId}` : '/bloodwork'

  return (
    <section className={`rounded-2xl border p-5 space-y-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">The Read</p>
          <p className="text-xs text-pens-cream/35 mt-0.5">
            Rolling {dateWindow.from} → {dateWindow.to}
          </p>
        </div>
        <Link
          href="/period-review"
          className="text-xs font-semibold text-cyan-300/90 hover:text-cyan-200 border border-cyan-400/30 rounded-lg px-2.5 py-1.5"
        >
          Open cockpit
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-pens-cream/40">Loading window…</p>
      ) : err ? (
        <p className="text-sm text-amber-200/80">{err}</p>
      ) : read ? (
        <>
          <p className="text-lg font-semibold text-pens-cream leading-snug">{read.headline}</p>
          {read.leadingCause ? (
            <p className="text-sm text-pens-cream/60">
              Likely cause: {read.leadingCause.label} (
              {Math.round(read.leadingCause.confidence * 100)}%)
            </p>
          ) : null}
          {read.nextAction ? (
            <p className="text-sm text-cyan-200/80">Next: {read.nextAction}</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-pens-cream/45">No live read yet — open the cockpit after sync.</p>
      )}
      {labs?.present ? (
        <Link
          href={labsHref}
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
            labs.flaggedCount > 0
              ? 'border-violet-400/40 text-violet-200/90 bg-violet-950/30'
              : 'border-pens-muted/30 text-pens-cream/55 bg-pens-navy/40'
          }`}
        >
          {labs.chipLabel}
        </Link>
      ) : null}
    </section>
  )
}
