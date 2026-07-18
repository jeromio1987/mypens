'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  Trophy,
  Wrench,
  HeartPulse,
  Bot,
  Activity,
  MessageSquare,
  Briefcase,
} from 'lucide-react'

interface WorkMetrics {
  available?: boolean
  sessions?: number
  promptCount?: number
  avgPromptChars?: number
  medianPromptChars?: number
  avgPromptWords?: number
  contextInclusionRate?: number
  toolUseCount?: number
  subagentCount?: number
  toolUsePerPrompt?: number
  lateNightPromptCount?: number
  shortPromptCount?: number
  longPromptCount?: number
}

interface HealthMetrics {
  sleep?: { avgHours: number; avgQuality: number; nights: number; nightsUnder6h5: number } | null
  weight?: { lastKg: number; trend: string; deltaKg: number } | null
  training?: { sessions: number; totalVolumeKg: number } | null
  food?: { avgKcalPerDay: number; avgProteinPerDay: number } | null
  mood?: { avgMood: number } | null
  anchor?: { cleanStreakDays: number; alcoholDaysThisWeek: number } | null
  garminEngine?: {
    available?: boolean
    coverageScore?: number
    summary?: string
    findings?: string[]
    risks?: string[]
    wins?: string[]
  }
}

interface Report {
  weekOf: string
  weekEnd: string
  combinedSummary: string
  healthAnalysis: string
  claudeWorkAnalysis: string
  wins: string[]
  improvements: string[]
  healthActions: string[]
  metrics: {
    work?: WorkMetrics
    health?: HealthMetrics
    crossLinks?: string[]
    isze?: {
      available?: boolean
      latestName?: string | null
      latestDate?: string | null
      runCount?: number
      summary?: string | null
      openLoops?: string[]
      analysis?: string
      actions?: string[]
      reason?: string | null
    }
  }
  model: string | null
  generatedAt: string
}

function fmtRange(weekOf: string, weekEnd: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const a = new Date(weekOf + 'T00:00:00').toLocaleDateString('en-GB', opts)
  const b = new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-GB', opts)
  return `${a} – ${b}`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-pens-surface/40 border border-pens-muted/20 rounded-xl p-3">
      <p className="text-[9px] uppercase tracking-widest text-pens-cream/40 font-semibold">{label}</p>
      <p className="text-lg font-black text-pens-cream mt-1">{value}</p>
      {hint && <p className="text-[10px] text-pens-cream/40 mt-0.5">{hint}</p>}
    </div>
  )
}

function ListCard({
  icon,
  title,
  accent,
  items,
}: {
  icon: React.ReactNode
  title: string
  accent: string
  items: string[]
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={accent}>{icon}</span>
        <p className={`text-[10px] uppercase tracking-widest font-semibold ${accent}`}>{title}</p>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-pens-cream/70 leading-relaxed flex gap-2">
            <span className={`${accent} font-black shrink-0`}>{i + 1}.</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function WeeklyFeedbackPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const runFetch = useCallback(() => {
    return fetch('/api/weekly-feedback')
      .then(r => r.json())
      .then(d => setReport(d.report ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    runFetch()
  }, [runFetch])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(false)
    runFetch()
  }, [runFetch])

  const work = report?.metrics?.work
  const health = report?.metrics?.health
  const isze = report?.metrics?.isze
  const crossLinks = report?.metrics?.crossLinks ?? []

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Weekly Feedback</h1>
              {report && (
                <p className="text-xs text-pens-cream/40 mt-0.5">{fmtRange(report.weekOf, report.weekEnd)}</p>
              )}
            </div>
          </div>
          <button
            onClick={refresh}
            className="text-xs text-pens-cream/30 hover:text-pens-cream/60 transition-colors px-2 py-1"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-pens-navy/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="bg-pens-navy/60 border border-pens-crimson/30 rounded-2xl p-6 text-center">
            <p className="text-sm text-pens-cream/70">Couldn&apos;t load this week&apos;s feedback.</p>
            <button onClick={refresh} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 font-bold">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !report && (
          <div className="bg-pens-navy/60 border border-pens-muted/20 rounded-2xl p-6 text-center space-y-3">
            <Sparkles size={24} className="text-cyan-400 mx-auto" />
            <p className="text-sm font-bold text-pens-cream">No feedback generated yet</p>
            <p className="text-xs text-pens-cream/50 leading-relaxed">
              Run the weekly generator locally to create your first report:
            </p>
            <code className="block text-[11px] font-mono text-cyan-300 bg-pens-surface/50 rounded-lg px-3 py-2">
              npm run feedback:weekly
            </code>
            <p className="text-[10px] text-pens-cream/40">
              It reads your health data and local Claude/Cursor transcripts, then writes the report here.
            </p>
          </div>
        )}

        {!loading && !error && report && (
          <>
            {/* Summary */}
            <div className="bg-gradient-to-br from-cyan-950/40 to-pens-navy/60 border border-cyan-900/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-cyan-400" />
                <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">The week in one read</p>
              </div>
              <p className="text-base text-pens-cream/90 leading-relaxed">{report.combinedSummary}</p>
              {crossLinks.length > 0 && (
                <div className="mt-4 border-t border-cyan-900/30 pt-3 space-y-1.5">
                  {crossLinks.map((l, i) => (
                    <p key={i} className="text-xs text-cyan-200/70 leading-relaxed flex gap-2">
                      <Activity size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                      <span>{l}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <ListCard icon={<Trophy size={14} />} title="Wins" accent="text-emerald-400" items={report.wins} />
            <ListCard
              icon={<Wrench size={14} />}
              title="Improvements · prompting & projects"
              accent="text-cyan-400"
              items={report.improvements}
            />
            <ListCard
              icon={<HeartPulse size={14} />}
              title="Health actions for next week"
              accent="text-amber-400"
              items={report.healthActions}
            />

            {/* Health analysis */}
            <div className="bg-pens-navy/60 border border-emerald-900/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse size={14} className="text-emerald-400" />
                <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Health &amp; life</p>
              </div>
              <p className="text-sm text-pens-cream/70 leading-relaxed">{report.healthAnalysis}</p>
              {health && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {health.sleep && (
                    <Stat label="Sleep" value={`${health.sleep.avgHours}h`} hint={`q${health.sleep.avgQuality} · ${health.sleep.nightsUnder6h5} short`} />
                  )}
                  {health.weight && (
                    <Stat label="Weight" value={`${health.weight.lastKg}kg`} hint={`${health.weight.trend} ${Math.abs(health.weight.deltaKg)}kg`} />
                  )}
                  {health.training && (
                    <Stat label="Training" value={`${health.training.sessions}×`} hint={`${health.training.totalVolumeKg}kg vol`} />
                  )}
                  {health.food && (
                    <Stat label="Food" value={`${health.food.avgKcalPerDay}`} hint={`${health.food.avgProteinPerDay}g protein/d`} />
                  )}
                  {health.mood && <Stat label="Mood" value={`${health.mood.avgMood}/5`} />}
                  {health.anchor && (
                    <Stat label="Anchor" value={`${health.anchor.cleanStreakDays}d`} hint={`${health.anchor.alcoholDaysThisWeek} drink day(s)`} />
                  )}
                </div>
              )}
            </div>

            {/* Garmin Analysis Engine */}
            {health?.garminEngine?.available && (
              <div className="bg-pens-navy/60 border border-orange-900/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className="text-orange-400" />
                  <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">
                    Garmin Analysis Engine
                  </p>
                  <span className="text-[10px] text-pens-cream/30 ml-auto">
                    coverage {health.garminEngine.coverageScore ?? 0}/6
                  </span>
                </div>
                <p className="text-sm text-pens-cream/70 leading-relaxed mb-3">
                  {health.garminEngine.summary}
                </p>
                {(health.garminEngine.findings ?? []).slice(0, 6).map((f, i) => (
                  <p key={i} className="text-xs text-pens-cream/55 leading-relaxed mb-1.5 flex gap-2">
                    <span className="text-orange-400 shrink-0">•</span>
                    <span>{f}</span>
                  </p>
                ))}
                {(health.garminEngine.risks ?? []).length > 0 && (
                  <div className="mt-3 border-t border-orange-900/30 pt-3">
                    <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold mb-2">Risks</p>
                    {(health.garminEngine.risks ?? []).map((r, i) => (
                      <p key={i} className="text-xs text-pens-cream/60 leading-relaxed mb-1">→ {r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ISZE / professional scheduled Feedback */}
            <div className="bg-pens-navy/60 border border-amber-900/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-amber-400" />
                <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                  Professional · ISZE Feedback
                </p>
              </div>
              <p className="text-sm text-pens-cream/70 leading-relaxed">
                {isze?.analysis ||
                  (isze?.available
                    ? isze.summary
                    : 'No ISZE scheduled Feedback brief loaded. Set PENS_ISZE_FEEDBACK_DIR if the archive lives elsewhere.')}
              </p>
              {isze?.openLoops && isze.openLoops.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-amber-900/30 pt-3">
                  {isze.openLoops.map((loop, i) => (
                    <li key={i} className="text-xs text-amber-100/70 leading-relaxed flex gap-2">
                      <span className="text-amber-400 font-black shrink-0">•</span>
                      <span>{loop}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isze?.actions && isze.actions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-semibold mb-2">
                    Close the loop
                  </p>
                  <ul className="space-y-1.5">
                    {isze.actions.map((a, i) => (
                      <li key={i} className="text-sm text-pens-cream/70 leading-relaxed flex gap-2">
                        <span className="text-amber-400 font-black shrink-0">{i + 1}.</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isze?.latestName && (
                <p className="text-[10px] text-pens-cream/30 mt-3">
                  Source: {isze.latestName}
                  {isze.runCount ? ` · ${isze.runCount} briefs in archive` : ''}
                </p>
              )}
            </div>

            {/* Claude work analysis */}
            <div className="bg-pens-navy/60 border border-cyan-900/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={14} className="text-cyan-400" />
                <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">Working with Claude</p>
              </div>
              <p className="text-sm text-pens-cream/70 leading-relaxed">{report.claudeWorkAnalysis}</p>
              {work?.available ? (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Stat label="Prompts" value={`${work.promptCount ?? 0}`} hint={`${work.sessions ?? 0} sessions`} />
                  <Stat label="Avg length" value={`${work.avgPromptChars ?? 0}`} hint="chars/prompt" />
                  <Stat label="Context rate" value={`${Math.round((work.contextInclusionRate ?? 0) * 100)}%`} hint="had files/goals" />
                  <Stat label="Tool calls" value={`${work.toolUseCount ?? 0}`} hint={`${work.subagentCount ?? 0} subagents`} />
                  <Stat label="Late-night" value={`${work.lateNightPromptCount ?? 0}`} hint="after 22:00" />
                  <Stat label="Short prompts" value={`${work.shortPromptCount ?? 0}`} hint="<60 chars" />
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-xs text-pens-cream/40">
                  <MessageSquare size={12} />
                  <span>No transcript data for this week.</span>
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-pens-cream/30 pt-2">
              Generated {new Date(report.generatedAt).toLocaleString('en-GB')}
              {report.model ? ` · ${report.model}` : ' · deterministic'}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
