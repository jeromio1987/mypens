'use client'

import Link from 'next/link'
import { ArrowLeft, Activity } from 'lucide-react'
import { useEffect, useState } from 'react'

type Item = {
  kind: 'training' | 'garmin_fit'
  id: string
  date: string
  title: string
  subtitle: string
  source: string
  externalUrl: string | null
  createdAt: string
}

export default function ActivityStreamPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch('/api/activity-feed?days=28')
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setItems(j.items || [])
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8 text-pens-cream">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/training" className="text-pens-cream/40 hover:text-pens-cream/70">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">Training</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity size={22} className="text-orange-400" />
              Activity stream
            </h1>
            <p className="text-xs text-pens-cream/45 mt-1">
              Manual log + Garmin FIT imports (last 28 days). Same ordering logic as the API feed.
            </p>
          </div>
        </div>

        {loading && <p className="text-sm text-pens-cream/40">Loading…</p>}
        {err && <p className="text-sm text-red-300/90">{err}</p>}

        {!loading && !err && (
          <ul className="space-y-2">
            {items.length === 0 ? (
              <li className="text-sm text-pens-cream/45 border border-pens-muted/25 rounded-xl p-4">No rows yet.</li>
            ) : (
              items.map((it) => (
                <li
                  key={`${it.kind}-${it.id}`}
                  className="rounded-xl border border-pens-muted/25 bg-pens-navy/50 px-4 py-3 flex flex-col gap-1"
                >
                  <div className="flex justify-between gap-2 text-xs text-pens-cream/40">
                    <span>{it.date}</span>
                    <span className="uppercase tracking-wide">
                      {it.kind === 'garmin_fit' ? 'Garmin FIT' : it.source}
                    </span>
                  </div>
                  <p className="font-semibold text-pens-cream">{it.title}</p>
                  <p className="text-xs text-pens-cream/55">{it.subtitle}</p>
                  {it.externalUrl && (
                    <a
                      href={it.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-pens-gold hover:underline w-fit"
                    >
                      Open source ↗
                    </a>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </main>
  )
}
