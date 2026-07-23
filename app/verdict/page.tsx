'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, ArrowUpRight, Activity, Utensils, Moon,
  Download, TrendingUp, TrendingDown,
} from 'lucide-react'
import type { VerdictData, VerdictPillar, LedgerItem } from '@/app/api/verdict/route'
import { VERDICT_LABELS } from '@/lib/explanationCopy'
import PremiumGate from '@/components/shared/PremiumGate'
import PathwayStatusChip from '@/components/pathways/PathwayStatusChip'

const PILLAR_ICONS: Record<string, React.ElementType> = {
  'arrow-up-right': ArrowUpRight,
  activity:         Activity,
  utensils:         Utensils,
  moon:             Moon,
}

const PILLAR_TITLE: Record<VerdictPillar['key'], string> = {
  P: VERDICT_LABELS.verdict_training,
  E: VERDICT_LABELS.verdict_anchor,
  N: VERDICT_LABELS.verdict_food,
  S: VERDICT_LABELS.verdict_sleep,
}

const PILLAR_SECTION: Record<VerdictPillar['key'], string> = {
  P: 'Physical Output',
  E: 'Internal Audit',
  N: 'Metabolic Impact',
  S: 'Recovery Audit',
}

const PILLAR_TAG_FOR_KEY: Record<VerdictPillar['key'], LedgerItem['pillar']> = {
  P: 'PERF',
  E: 'ENDU',
  N: 'NUTR',
  S: 'SLEP',
}

const PILLAR_TAG_STYLES: Record<LedgerItem['pillar'], string> = {
  PERF: 'bg-blue-900/30    text-blue-300    border-blue-700/40',
  ENDU: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40',
  NUTR: 'bg-amber-900/30   text-pens-gold   border-amber-700/40',
  SLEP: 'bg-violet-900/30  text-violet-300  border-violet-700/40',
}

const MODE_LABEL: Record<string, { label: string; tone: string }> = {
  locked_in: { label: 'Locked In', tone: 'text-pens-crimson' },
  balanced:  { label: 'Balanced',  tone: 'text-pens-gold'    },
  off:       { label: 'Rest Day',  tone: 'text-pens-cream/40' },
}

function scoreTone(score: number): string {
  if (score >= 75) return 'text-pens-cream'
  if (score >= 55) return 'text-pens-gold'
  if (score >= 40) return 'text-amber-400'
  return 'text-pens-crimson'
}

function gaugeTone(score: number): string {
  if (score >= 75) return 'from-pens-cream to-transparent'
  if (score >= 55) return 'from-pens-gold to-transparent'
  if (score >= 40) return 'from-amber-400 to-transparent'
  return 'from-pens-crimson to-transparent'
}

// ── Sub-card: a ledger item rendered like a "Tax / Offset" entry ─────────────
function LedgerCard({ item }: { item: LedgerItem }) {
  const positive = item.points >= 0
  return (
    <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-sm font-bold text-pens-cream leading-tight">{item.label}</p>
        <span className={`flex items-center gap-0.5 text-base font-black tabular-nums ${positive ? 'text-emerald-400' : 'text-pens-crimson'}`}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {positive ? `+${item.points}` : item.points}
        </span>
      </div>
      <p className="text-xs text-pens-cream/50 leading-relaxed mb-2">{item.detail}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-pens-cream/30">{item.date}</span>
        <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${PILLAR_TAG_STYLES[item.pillar]}`}>
          {item.pillar}
        </span>
      </div>
    </div>
  )
}

// ── Section: one editorial block per pillar ──────────────────────────────────
function PillarSection({
  pillar,
  ledger,
  hasEnoughData,
}: {
  pillar: VerdictPillar
  ledger: LedgerItem[]
  hasEnoughData: boolean
}) {
  const Icon  = PILLAR_ICONS[pillar.icon] ?? ArrowUpRight
  const noData = !hasEnoughData || !pillar.hasData
  const tag   = PILLAR_TAG_FOR_KEY[pillar.key]
  const items = ledger.filter(l => l.pillar === tag).slice(0, 2)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-t border-pens-muted/20 pt-5">
        <Icon size={11} className="text-pens-crimson/70" />
        <p className="text-[10px] uppercase tracking-[0.22em] text-pens-cream/40 font-semibold">
          {PILLAR_SECTION[pillar.key]}
        </p>
      </div>

      <h2 className="text-2xl font-bold italic text-pens-cream leading-tight tracking-tight">
        {PILLAR_TITLE[pillar.key]}
      </h2>

      <p className="text-sm text-pens-cream/65 leading-relaxed">
        {pillar.comment}
      </p>

      {/* The metric */}
      <div className="flex items-baseline gap-2 pt-1">
        {noData ? (
          <span className="text-5xl font-black tracking-tight text-pens-cream/20">—</span>
        ) : (
          <>
            <span className={`text-5xl font-black tracking-tight tabular-nums ${scoreTone(pillar.score)}`}>
              {pillar.score}
            </span>
            <span className="text-xs uppercase tracking-widest text-pens-cream/30">/ 99</span>
          </>
        )}
      </div>

      {/* Gauge bar */}
      <div className="relative h-1 bg-pens-surface/40 rounded-full overflow-hidden">
        {!noData && (
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gaugeTone(pillar.score)}`}
            style={{ width: `${Math.max(2, pillar.score)}%` }}
          />
        )}
      </div>

      {/* Pillar-specific ledger items, when present */}
      {items.length > 0 && (
        <div className="space-y-2 pt-2">
          {items.map((item, i) => <LedgerCard key={`${pillar.key}-${i}`} item={item} />)}
        </div>
      )}
    </section>
  )
}

function formatHoursAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 60_000) return 'just now'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'under 1 hour ago'
  if (h === 1) return '1 hour ago'
  return `${h} hours ago`
}

export default function VerdictPage() {
  const [data, setData]       = useState<VerdictData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [aiSummary, setAiSummary]       = useState<string | null>(null)
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null)
  const [aiLoading, setAiLoading]       = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/verdict')
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !json || !Array.isArray(json.pillars)) {
          setError(typeof json?.error === 'string' ? json.error : 'Could not compute the verdict.')
          return
        }
        setData(json as VerdictData)
      } catch {
        if (!cancelled) setError('Could not reach the verdict API.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/verdict/summary')
        const json = (await res.json().catch(() => null)) as {
          summary?: string | null
          error?: boolean
          generatedAt?: string
        } | null
        if (cancelled) return
        if (
          json &&
          typeof json.summary === 'string' &&
          json.summary.trim().length > 0 &&
          !json.error
        ) {
          setAiSummary(json.summary.trim())
          setAiGeneratedAt(
            typeof json.generatedAt === 'string' ? json.generatedAt : null,
          )
        } else {
          setAiSummary(null)
          setAiGeneratedAt(null)
        }
      } catch {
        if (!cancelled) {
          setAiSummary(null)
          setAiGeneratedAt(null)
        }
      } finally {
        if (!cancelled) setAiLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Headline metric: average of the four pillar scores (when we have data)
  const avgScore = data && data.hasEnoughData
    ? Math.round(data.pillars.reduce((s, p) => s + p.score, 0) / data.pillars.length)
    : null

  return (
    <main className="min-h-screen bg-pens-deep">
      <div className="max-w-sm mx-auto px-5 pt-7 pb-28 space-y-7">

        {/* Top brand strip */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="text-pens-cream/30 hover:text-pens-cream/60 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <p className="text-[10px] uppercase tracking-[0.3em] text-pens-cream/40 italic font-semibold">
            The Continental
          </p>
          <Link
            href="/verdict/dossier"
            aria-label="Full dossier"
            className="text-[10px] uppercase tracking-widest text-pens-cream/30 hover:text-pens-cream/60 transition-colors"
          >
            Dossier
          </Link>
        </div>

        {/* Title */}
        <header className="space-y-3">
          <h1 className="text-[44px] leading-[0.95] font-black italic tracking-tight text-pens-cream">
            The<br />Verdict.
          </h1>
          {loading ? (
            <div className="h-5 w-56 bg-pens-surface/40 rounded animate-pulse" />
          ) : (
            <p className="text-base text-pens-cream/60 italic leading-snug border-l-2 border-pens-crimson/60 pl-3">
              &ldquo;{data?.headline}&rdquo;
            </p>
          )}
          {data?.weekRange && (
            <p className="text-[10px] uppercase tracking-[0.25em] text-pens-cream/25 font-medium">
              {data.weekRange}
            </p>
          )}
        </header>

        <PathwayStatusChip />

        {/* Audit summary card */}
        {!loading && data && (
          <div className="relative bg-pens-navy border border-pens-muted/30 rounded-2xl p-5 overflow-hidden">
            <div className="absolute inset-y-0 right-0 w-1 bg-pens-crimson/60" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-pens-cream/40 font-semibold">
                  Audit Period
                </p>
                <p className="text-sm font-bold text-pens-cream mt-0.5">
                  Past 7 days
                </p>
                {data.todayMode && (
                  <p className={`text-[10px] uppercase tracking-widest mt-2 font-bold ${MODE_LABEL[data.todayMode]?.tone ?? 'text-pens-cream/40'}`}>
                    Today · {MODE_LABEL[data.todayMode]?.label ?? data.todayMode}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {avgScore !== null ? (
                  <>
                    <p className={`text-5xl font-black leading-none tabular-nums tracking-tight ${scoreTone(avgScore)}`}>
                      {avgScore}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold mt-1.5">
                      P.E.N.S. Score
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-black leading-none text-pens-cream/15 tracking-tight">—</p>
                    <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold mt-1.5">
                      Insufficient signal
                    </p>
                  </>
                )}
              </div>
            </div>
            {data.modeNote && (
              <p className="text-xs text-pens-cream/50 leading-relaxed mt-4 pt-4 border-t border-pens-muted/20">
                {data.modeNote}
              </p>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-pens-surface/30 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-pens-crimson/15 border border-pens-crimson/40 rounded-2xl p-5 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-bold">
              Audit unavailable
            </p>
            <p className="text-sm text-pens-cream/70 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Insufficient-data guidance */}
        {!loading && data && !data.hasEnoughData && (
          <div className="bg-pens-surface/40 border border-pens-muted/20 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">
              How the audit unlocks
            </p>
            <div className="space-y-2">
              {[
                'Select a mode each morning on the home screen.',
                'Log sleep each night — even one entry unlocks Sleep + Endurance.',
                'Record one training session to unlock Performance.',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[10px] font-black text-pens-crimson/70 shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-xs text-pens-cream/50 leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly AI audit — above pillar breakdown; fetch is independent */}
        {(aiLoading || aiSummary) && (
          <PremiumGate feature="AI weekly audit" className="rounded-2xl">
            <div className="rounded-2xl border border-pens-muted/30 bg-black/60 p-5 space-y-3 min-h-[120px]">
              {aiLoading ? (
                <>
                  <div className="h-3 w-full bg-pens-cream/10 rounded animate-pulse" />
                  <div className="h-3 w-[92%] bg-pens-cream/10 rounded animate-pulse" />
                  <div className="h-3 w-[88%] bg-pens-cream/10 rounded animate-pulse" />
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-pens-crimson font-bold">
                    THE WEEKLY AUDIT — AI VERDICT
                  </p>
                  <p className="text-sm text-pens-cream font-mono leading-relaxed">{aiSummary}</p>
                  {aiGeneratedAt && (
                    <p className="text-xs text-pens-cream/30 pt-1">
                      Generated {formatHoursAgo(aiGeneratedAt)} · Claude
                    </p>
                  )}
                </>
              )}
            </div>
          </PremiumGate>
        )}

        {/* Per-pillar editorial sections */}
        {!loading && data && (
          <div className="space-y-7">
            {data.pillars.map(p => (
              <PillarSection
                key={p.key}
                pillar={p}
                ledger={data.ledger}
                hasEnoughData={data.hasEnoughData}
              />
            ))}
          </div>
        )}

        {/* Auditor's Note — closing manifesto */}
        {!loading && data?.auditorNote && (
          <div className="relative bg-gradient-to-br from-pens-surface to-pens-navy border border-pens-muted/20 rounded-2xl overflow-hidden mt-2">
            {/* Portrait accent — the Auditor */}
            <div className="absolute top-0 right-0 w-28 h-32 opacity-25 pointer-events-none select-none">
              <Image
                src="/illustrations/gritty-portrait.png"
                alt=""
                fill
                sizes="112px"
                className="object-cover object-[center_15%] grayscale"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-pens-surface" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-pens-surface to-transparent" />
            </div>

            <div className="relative p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-px w-6 bg-pens-crimson/60" />
                <p className="text-[10px] uppercase tracking-widest text-pens-crimson/80 font-semibold">
                  The Auditor&apos;s Note
                </p>
              </div>
              <blockquote className="text-xl font-bold italic text-pens-cream leading-snug">
                &ldquo;{data.auditorNote.quote}&rdquo;
              </blockquote>
              <div className="border-t border-pens-muted/20 pt-4">
                <p className="text-sm text-pens-cream/60 leading-relaxed">
                  {data.auditorNote.body}
                </p>
              </div>
              <p className="text-xs italic text-pens-cream/40 leading-relaxed pt-1">
                The numbers are in. The damage is quantified. What remains is your accountability.
              </p>
              <Link
                href="/data"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-pens-crimson text-pens-cream rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-pens-crimson/90 transition-colors"
              >
                <Download size={13} />
                Acknowledge the Verdict
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* Fixed bottom nav — pillar quick-jump */}
      <nav className="fixed bottom-0 left-0 right-0 bg-pens-deep/95 backdrop-blur border-t border-pens-muted/20">
        <div className="max-w-sm mx-auto grid grid-cols-4">
          {[
            { href: '/training', label: 'Performance', Icon: ArrowUpRight },
            { href: '/dashboard', label: 'Endurance',   Icon: Activity },
            { href: '/context',   label: 'Nutrition',   Icon: Utensils },
            { href: '/sleep',     label: 'Sleep',       Icon: Moon },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-3.5 text-pens-cream/30 hover:text-pens-cream/70 transition-colors"
            >
              <Icon size={16} />
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
