'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowUpRight, Activity, Utensils, Moon,
  Download, TrendingUp, TrendingDown,
} from 'lucide-react'
import type { VerdictData, VerdictPillar, LedgerItem } from '@/app/api/verdict/route'

const PILLAR_ICONS: Record<string, React.ElementType> = {
  'arrow-up-right': ArrowUpRight,
  activity:         Activity,
  utensils:         Utensils,
  moon:             Moon,
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-pens-cream'
  if (score >= 55) return 'text-pens-gold'
  if (score >= 40) return 'text-amber-400'
  return 'text-pens-crimson'
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-pens-surface/80'
  if (score >= 55) return 'bg-pens-surface/80'
  if (score >= 40) return 'bg-amber-900/20'
  return 'bg-pens-crimson/10 border-pens-crimson/30'
}

const PILLAR_TAG_STYLES: Record<string, string> = {
  PERF: 'bg-blue-900/30 text-blue-300',
  ENDU: 'bg-emerald-900/30 text-emerald-300',
  NUTR: 'bg-amber-900/30 text-pens-gold',
  SLEP: 'bg-violet-900/30 text-violet-300',
}

function PillarCard({ p }: { p: VerdictPillar }) {
  const Icon = PILLAR_ICONS[p.icon] ?? ArrowUpRight
  const isWeak = p.score < 40
  return (
    <div className={`rounded-2xl border border-pens-muted/20 p-5 ${scoreBg(p.score)} ${isWeak ? 'border-pens-crimson/30' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <Icon size={18} className={`${scoreColor(p.score)} shrink-0 mt-0.5`} />
        <span className={`text-5xl font-black leading-none ${scoreColor(p.score)}`}>
          {p.score}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold mb-2">
        {p.label}
      </p>
      <p className="text-xs text-pens-cream/50 leading-relaxed">
        {p.comment}
      </p>
    </div>
  )
}

function LedgerRow({ item }: { item: LedgerItem }) {
  const positive = item.points >= 0
  return (
    <div className="flex items-start gap-4 py-3 border-b border-pens-muted/10 last:border-0">
      <div className="w-10 shrink-0 text-right mt-0.5">
        <p className="text-[10px] text-pens-cream/30 leading-tight">{item.date}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-pens-cream leading-tight">{item.label}</p>
        <p className="text-xs text-pens-cream/30 mt-0.5">{item.detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-0.5 text-sm font-bold ${positive ? 'text-emerald-400' : 'text-pens-crimson'}`}>
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {positive ? `+${item.points}` : item.points}
        </span>
        <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${PILLAR_TAG_STYLES[item.pillar]}`}>
          {item.pillar}
        </span>
      </div>
    </div>
  )
}

export default function VerdictPage() {
  const [data, setData]       = useState<VerdictData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/verdict')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-pens-deep">
      <div className="max-w-sm mx-auto px-4 pt-8 pb-28 space-y-8">

        {/* Back nav */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-pens-cream/30 hover:text-pens-cream/60 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-medium">The Verdict</p>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold italic text-pens-cream leading-tight mb-3">
            Member<br />Dashboard
          </h1>
          {loading ? (
            <div className="h-5 w-48 bg-pens-surface/40 rounded animate-pulse" />
          ) : (
            <p className="text-base text-pens-cream/50 italic leading-snug">
              &ldquo;{data?.headline}&rdquo;
            </p>
          )}
          {data?.weekRange && (
            <p className="text-[10px] uppercase tracking-widest text-pens-cream/20 mt-2 font-medium">
              {data.weekRange}
            </p>
          )}
        </div>

        {/* Pillar scores */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-pens-surface/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data?.pillars.map(p => <PillarCard key={p.key} p={p} />)}
          </div>
        )}

        {/* The Recent Ledger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold italic text-pens-cream">The Recent Ledger</h2>
            <Link href="/dashboard" className="text-[10px] uppercase tracking-widest text-pens-cream/30 hover:text-pens-cream/60 transition-colors font-medium">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-14 rounded-xl bg-pens-surface/30 animate-pulse" />
              ))}
            </div>
          ) : data?.ledger.length ? (
            <div className="bg-pens-surface/50 border border-pens-muted/20 rounded-2xl px-4 py-1">
              {data.ledger.map((item, i) => <LedgerRow key={i} item={item} />)}
            </div>
          ) : (
            <div className="text-sm text-pens-cream/30 py-6 text-center">
              No ledger entries yet — log training, sleep or context to build your record.
            </div>
          )}
        </div>

        {/* Auditor's Note */}
        {data?.auditorNote && (
          <div className="bg-gradient-to-br from-pens-surface to-pens-navy border border-pens-muted/20 rounded-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold">
                The Auditor&apos;s Note
              </p>
              <blockquote className="text-xl font-bold italic text-pens-cream leading-snug">
                &ldquo;{data.auditorNote.quote}&rdquo;
              </blockquote>
              <div className="border-t border-pens-muted/20 pt-4">
                <p className="text-sm text-pens-cream/50 leading-relaxed">
                  {data.auditorNote.body}
                </p>
              </div>
              <Link
                href="/data"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-pens-cream text-pens-deep rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-pens-cream/90 transition-colors"
              >
                <Download size={14} />
                Download Full Audit
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-pens-deep/95 backdrop-blur border-t border-pens-muted/20">
        <div className="max-w-sm mx-auto grid grid-cols-4">
          {[
            { href: '/weight',       label: 'Weight',   Icon: ArrowUpRight },
            { href: '/sleep',        label: 'Sleep',    Icon: Moon },
            { href: '/measurements', label: 'Body',     Icon: Activity },
            { href: '/dashboard',    label: 'Overview', Icon: Utensils },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-4 text-pens-cream/30 hover:text-pens-cream/70 transition-colors"
            >
              <Icon size={18} />
              <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  )
}
