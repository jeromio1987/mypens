'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, ArrowUpRight, Activity, Utensils, Moon,
  Download, TrendingUp, TrendingDown, BarChart2, ListChecks, FileText,
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

const MODE_LABEL: Record<string, { label: string; color: string }> = {
  locked_in: { label: 'Locked In', color: 'text-pens-crimson' },
  balanced:   { label: 'Balanced',  color: 'text-pens-gold'   },
  off:        { label: 'Rest Day',  color: 'text-pens-cream/40' },
}

function PillarCard({ p, hasEnoughData }: { p: VerdictPillar; hasEnoughData: boolean }) {
  const Icon = PILLAR_ICONS[p.icon] ?? ArrowUpRight
  const noData = !hasEnoughData || !p.hasData
  const isWeak = !noData && p.score < 40
  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      noData
        ? 'bg-pens-surface/30 border-pens-muted/10'
        : `${scoreBg(p.score)} border-pens-muted/20 ${isWeak ? 'border-pens-crimson/30' : ''}`
    }`}>
      <div className="flex items-start justify-between mb-4">
        <Icon size={18} className={`${noData ? 'text-pens-cream/20' : scoreColor(p.score)} shrink-0 mt-0.5`} />
        {noData ? (
          <span className="text-4xl font-black leading-none text-pens-cream/15 tracking-tight">—</span>
        ) : (
          <span className={`text-5xl font-black leading-none ${scoreColor(p.score)}`}>
            {p.score}
          </span>
        )}
      </div>
      <p className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${noData ? 'text-pens-cream/20' : 'text-pens-cream/40'}`}>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="text-pens-cream/30 hover:text-pens-cream/60 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-medium">The Verdict</p>
          </div>
          <Link
            href="/verdict/dossier"
            className="text-[10px] uppercase tracking-widest text-pens-crimson/80 hover:text-pens-crimson font-bold border-b border-pens-crimson/40 hover:border-pens-crimson transition-colors"
          >
            Damage Audit →
          </Link>
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

        {/* Today's Flow — page nav */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 flex-1 bg-pens-surface/60 border border-pens-muted/20 hover:border-pens-muted/40 rounded-xl px-3 py-2.5 transition-colors"
          >
            <BarChart2 size={13} className="text-pens-cream/40 shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-cream/30 font-semibold leading-none mb-0.5">Today</p>
              <p className="text-xs font-bold text-pens-cream/60 truncate">Mode</p>
            </div>
          </Link>
          <Link
            href="/context"
            className="flex items-center gap-1.5 flex-1 bg-pens-surface/60 border border-pens-muted/20 hover:border-pens-muted/40 rounded-xl px-3 py-2.5 transition-colors"
          >
            <ListChecks size={13} className="text-pens-cream/40 shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-cream/30 font-semibold leading-none mb-0.5">Log</p>
              <p className="text-xs font-bold text-pens-cream/60 truncate">Context</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 flex-1 bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2.5">
            <FileText size={13} className="text-pens-crimson shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-pens-crimson/70 font-semibold leading-none mb-0.5">Review</p>
              <p className="text-xs font-bold text-pens-cream truncate">Verdict</p>
            </div>
          </div>
        </div>

        {/* Mode context banner */}
        {!loading && data?.modeNote && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            data.todayMode === 'off'
              ? 'bg-pens-muted/20 border-pens-muted/30'
              : data.todayMode === 'locked_in'
              ? 'bg-pens-crimson/10 border-pens-crimson/30'
              : 'bg-pens-surface/60 border-pens-muted/20'
          }`}>
            <div className="min-w-0">
              <p className={`text-[9px] uppercase tracking-widest font-bold mb-0.5 ${
                data.todayMode === 'locked_in' ? 'text-pens-crimson' :
                data.todayMode === 'off' ? 'text-pens-cream/40' : 'text-pens-gold'
              }`}>
                Today · {data.todayMode ? (MODE_LABEL[data.todayMode]?.label ?? data.todayMode) : 'No mode set'}
              </p>
              <p className="text-xs text-pens-cream/50 leading-relaxed">{data.modeNote}</p>
            </div>
          </div>
        )}

        {/* Pillar scores */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-pens-surface/30 animate-pulse" />
            ))}
          </div>
        ) : !data?.hasEnoughData ? (
          <div className="space-y-3">
            {data?.pillars.map(p => <PillarCard key={p.key} p={p} hasEnoughData={false} />)}
            <div className="bg-pens-surface/40 border border-pens-muted/20 rounded-2xl p-5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/30 font-semibold">How scores unlock</p>
              <div className="space-y-1.5">
                {[
                  { step: '1', text: 'Select a mode each morning on the home screen' },
                  { step: '2', text: 'Log sleep each night — even one entry unlocks Sleep + Endurance' },
                  { step: '3', text: 'Record one training session to unlock Performance' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="text-[10px] font-bold text-pens-crimson/60 shrink-0 mt-0.5">{s.step}</span>
                    <p className="text-xs text-pens-cream/40 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.pillars.map(p => <PillarCard key={p.key} p={p} hasEnoughData={data.hasEnoughData} />)}
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
          <div className="relative bg-gradient-to-br from-pens-surface to-pens-navy border border-pens-muted/20 rounded-2xl overflow-hidden">
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
