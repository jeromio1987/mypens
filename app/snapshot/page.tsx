'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface WeightRow {
  date: string
  scaleKg: number
  trueWeightKg: number
  confidence: string
}

function SnapshotInner() {
  const sp = useSearchParams()
  const t = sp.get('t')
  const [rows, setRows] = useState<WeightRow[] | null>(null)
  const [meta, setMeta] = useState<{ generatedAt?: string; expiresAt?: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!t) {
      setErr('Missing token. Open a valid share link.')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/public/snapshot?t=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (!res.ok) {
          if (!cancelled) setErr(typeof data.error === 'string' ? data.error : 'Could not load snapshot')
          return
        }
        if (!cancelled) {
          setRows(Array.isArray(data.weights) ? data.weights : [])
          setMeta({ generatedAt: data.generatedAt, expiresAt: data.expiresAt })
          setErr(null)
        }
      } catch {
        if (!cancelled) setErr('Network error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
          <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Shared weight snapshot</h1>
          <p className="text-xs text-pens-cream/40 mt-1">Read-only · last seven logged days</p>
        </div>

        {err && (
          <div className="rounded-xl border border-pens-crimson/40 bg-pens-crimson/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {rows && (
          <div className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 space-y-3">
            {meta?.expiresAt && (
              <p className="text-[11px] text-pens-cream/40">Link expires: {meta.expiresAt}</p>
            )}
            {meta?.generatedAt && (
              <p className="text-[11px] text-pens-cream/35">Generated: {meta.generatedAt}</p>
            )}
            {rows.length === 0 ? (
              <p className="text-sm text-pens-cream/50">No weight rows in range yet.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((w) => (
                  <li
                    key={w.date}
                    className="flex justify-between gap-3 rounded-lg border border-pens-muted/25 bg-pens-deep/60 px-3 py-2 text-sm"
                  >
                    <span className="text-pens-cream/80 font-mono">{w.date}</span>
                    <span className="text-pens-cream text-right">
                      {w.trueWeightKg} kg
                      <span className="block text-[10px] text-pens-cream/40">
                        scale {w.scaleKg} kg · {w.confidence}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Link href="/login" className="inline-block text-xs text-pens-gold hover:text-pens-cream">
          Owner login →
        </Link>
      </div>
    </main>
  )
}

export default function SharedSnapshotPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-pens-deep p-8 text-sm text-pens-cream/40">Loading…</div>
      }
    >
      <SnapshotInner />
    </Suspense>
  )
}
