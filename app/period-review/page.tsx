'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarRange, Layers } from 'lucide-react'

interface Advice {
  period: string
  kind: string
  text: string
}

interface Segment {
  verdict: string
  from: string
  to: string
  weeks: number
  approxMonths: number
  avgScore?: number
}

interface Horizon {
  label: string
  months: number | null
  from: string
  to: string
  verdict: string | null
  score: number | null
  weeks: number
  goodWeeks?: number
  mixedWeeks?: number
  badWeeks?: number
  coverageRatio?: number | null
  segments?: Segment[]
  nested?: { note?: string } | null
  advice?: Advice[]
}

interface Report {
  asOf: string
  headline: string
  generatedAt?: string
  dataSpan?: { from: string | null; to: string | null }
  segments?: Segment[]
  horizons?: Horizon[]
}

function verdictColor(v: string | null | undefined) {
  if (v === 'good') return 'text-emerald-400'
  if (v === 'bad') return 'text-pens-crimson'
  if (v === 'mixed') return 'text-amber-400'
  return 'text-pens-cream/40'
}

export default function PeriodReviewPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMonths, setActiveMonths] = useState<number | 'all'>(12)

  useEffect(() => {
    let cancelled = false
    fetch('/api/period-review')
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setReport(data.report ?? null)
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const horizons = report?.horizons ?? []
  const active =
    activeMonths === 'all'
      ? horizons.find(h => h.months == null)
      : horizons.find(h => h.months === activeMonths)

  return (
    <div className="min-h-screen bg-pens-deep text-pens-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/weekly-feedback"
          className="inline-flex items-center gap-2 text-pens-cream/50 hover:text-pens-cream text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Weekly feedback
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <CalendarRange className="text-cyan-400" size={22} />
          <h1 className="text-2xl font-semibold tracking-tight">Period Review</h1>
        </div>
        <p className="text-sm text-pens-cream/50 mb-8 leading-relaxed">
          Advice depends on the window you discuss. A strong 3 months inside a weak 12 months stays
          good when named alone — the 12-month verdict can still be bad.
        </p>

        {loading && <p className="text-sm text-pens-cream/40">Loading…</p>}
        {error && <p className="text-sm text-pens-crimson">{error}</p>}
        {!loading && !error && !report && (
          <div className="bg-pens-navy/60 border border-cyan-900/30 rounded-2xl p-5">
            <p className="text-sm text-pens-cream/70 leading-relaxed">
              No period review yet. On your machine, after importing Garmin data:
            </p>
            <pre className="mt-3 text-xs text-cyan-200/80 bg-black/30 rounded-xl p-3 overflow-x-auto">
              npm run analyze:periods
            </pre>
          </div>
        )}

        {report && (
          <>
            <div className="bg-pens-navy/60 border border-cyan-900/30 rounded-2xl p-5 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold mb-2">
                Headline
              </p>
              <p className="text-sm text-pens-cream/80 leading-relaxed">{report.headline}</p>
              <p className="text-[10px] text-pens-cream/30 mt-3">
                As of {report.asOf}
                {report.dataSpan?.from ? ` · data ${report.dataSpan.from} → ${report.dataSpan.to}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveMonths(m)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                    activeMonths === m
                      ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                      : 'border-pens-cream/10 text-pens-cream/45 hover:text-pens-cream/70'
                  }`}
                >
                  {m}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActiveMonths('all')}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                  activeMonths === 'all'
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                    : 'border-pens-cream/10 text-pens-cream/45 hover:text-pens-cream/70'
                }`}
              >
                all history
              </button>
            </div>

            {active && (
              <div className="bg-pens-navy/60 border border-cyan-900/30 rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-cyan-400" />
                  <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">
                    {active.label}
                  </p>
                  <span className={`text-xs font-semibold ml-auto ${verdictColor(active.verdict)}`}>
                    {active.verdict ?? 'n/a'}
                    {active.score != null ? ` · ${active.score}/100` : ''}
                  </span>
                </div>
                {active.nested?.note && (
                  <p className="text-sm text-pens-cream/70 leading-relaxed mb-3">{active.nested.note}</p>
                )}
                {(active.segments ?? []).length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {active.segments!.map((s, i) => (
                      <p key={i} className="text-xs text-pens-cream/55 flex gap-2">
                        <span className={`font-semibold shrink-0 ${verdictColor(s.verdict)}`}>
                          {s.verdict}
                        </span>
                        <span>
                          {s.from} → {s.to} · ~{s.approxMonths} mo
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/35 font-semibold mb-2">
                  Advice for this period
                </p>
                <ul className="space-y-2">
                  {(active.advice ?? []).map((a, i) => (
                    <li key={i} className="text-sm text-pens-cream/70 leading-relaxed">
                      <span className="text-cyan-400/80 text-[11px]">{a.period}</span>
                      <br />
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(report.segments ?? []).length > 0 && (
              <div className="bg-pens-navy/40 border border-pens-cream/5 rounded-2xl p-5">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold mb-3">
                  All stretches
                </p>
                <div className="space-y-1.5">
                  {report.segments!.map((s, i) => (
                    <p key={i} className="text-xs text-pens-cream/50 flex gap-2">
                      <span className={`font-semibold shrink-0 ${verdictColor(s.verdict)}`}>
                        {s.verdict}
                      </span>
                      <span>
                        {s.from} → {s.to} · ~{s.approxMonths} mo · avg {s.avgScore}/100
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
