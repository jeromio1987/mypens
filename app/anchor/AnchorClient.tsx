'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ----- Types mirroring the server props ----------------------------------
interface Settings {
  drinkCostEur: number
  cocaineGramEur: number
  escortNightEur: number
  baselineDrinksPerWeek: number
  baselineCocaineGramsPerMonth: number
  baselineEscortsPerMonth: number
  resetStartDate: string
  phase1ResetDays: number
}
interface Streaks {
  alcoholFreeDays: number
  cocaineFreeDays: number
  escortFreeDays: number
  compoundCleanDays: number
}
interface Money {
  alcoholEur: number
  cocaineEur: number
  escortEur: number
  totalEur: number
  daysCounted: number
}
interface TodayEntry {
  date: string
  alcoholDrinks: number
  cocaineUsed: boolean
  escortUsed: boolean
  mood: number | null
  energy: number | null
  sleepHours: number | null
  supplements: string[]
  notes: string | null
}
interface RecentEntry {
  date: string
  alcoholDrinks: number
  cocaineUsed: boolean
  escortUsed: boolean
}
interface Craving {
  id: string
  createdAt: string
  target: string
  action: string
  outcome: string
  trigger: string | null
}
interface MilestoneInfo { target: number; daysLeft: number }
interface Phase { dayNumber: number; total: number; progress: number }

interface Props {
  today: string
  settings: Settings
  streaks: Streaks
  money: Money
  todayEntry: TodayEntry | null
  recentEntries: RecentEntry[]
  recentCravings: Craving[]
  milestone: { compound: MilestoneInfo; alcohol: MilestoneInfo }
  phase: Phase
}

// ----- Supplement chips: match the protocol ------------------------------
const SUPPLEMENTS = [
  'Magnesium',
  'Omega-3',
  'L-Theanine',
  'NAC',
  'Creatine',
  'Saffron',
] as const

// ----- Helpers -----------------------------------------------------------
function eur(n: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

// ============================================================================
export default function AnchorClient(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Local mirror of today's entry — optimistic.
  const [entry, setEntry] = useState<TodayEntry>(
    props.todayEntry ?? {
      date: props.today,
      alcoholDrinks: 0,
      cocaineUsed: false,
      escortUsed: false,
      mood: null,
      energy: null,
      sleepHours: null,
      supplements: [],
      notes: null,
    },
  )

  async function save(patch: Partial<TodayEntry>) {
    const next = { ...entry, ...patch }
    setEntry(next)
    try {
      await fetch('/api/anchor/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: next.date,
          alcoholDrinks: next.alcoholDrinks,
          cocaineUsed: next.cocaineUsed,
          escortUsed: next.escortUsed,
          mood: next.mood,
          energy: next.energy,
          sleepHours: next.sleepHours,
          supplements: next.supplements,
          notes: next.notes,
        }),
      })
      // Re-pull server state so streaks update.
      startTransition(() => router.refresh())
    } catch (err) {
      console.error('save failed', err)
    }
  }

  function toggleSupplement(name: string) {
    const has = entry.supplements.includes(name)
    const next = has
      ? entry.supplements.filter(s => s !== name)
      : [...entry.supplements, name]
    void save({ supplements: next })
  }

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream font-[family-name:var(--font-geist-sans)] pb-24">
      {/* — HEADER — */}
      <header className="px-5 pt-7 pb-3 flex items-center justify-between border-b border-pens-cream/10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-pens-cream/60">
            Anchor
          </div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-2xl font-bold leading-tight">
            {greetingFor(props.today)}
          </h1>
          <div className="text-xs text-pens-cream/50 mt-0.5">{props.today}</div>
        </div>
        <Link
          href="/"
          className="text-[11px] uppercase tracking-[0.15em] text-pens-cream/60 hover:text-pens-cream"
        >
          Home
        </Link>
      </header>

      {/* — MONEY SAVED HERO — */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-pens-surface/60 border border-pens-gold/20 p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-pens-gold/80">
            Saved since reset
          </div>
          <div className="font-[family-name:var(--font-newsreader)] text-5xl font-bold mt-1 text-pens-gold tabular-nums">
            {eur(props.money.totalEur)}
          </div>
          <div className="text-xs text-pens-cream/60 mt-2 flex items-center gap-3 flex-wrap">
            <span>{props.money.daysCounted} day{props.money.daysCounted === 1 ? '' : 's'}</span>
            <span className="text-pens-cream/30">·</span>
            <span>{eur(props.money.alcoholEur)} alcohol</span>
            <span className="text-pens-cream/30">·</span>
            <span>{eur(props.money.cocaineEur)} cocaine</span>
            <span className="text-pens-cream/30">·</span>
            <span>{eur(props.money.escortEur)} escorts</span>
          </div>
        </div>
      </section>

      {/* — STREAK BOARD — */}
      <section className="px-5 pt-5">
        <div className="grid grid-cols-3 gap-2">
          <StreakCard
            label="Alcohol-free"
            days={props.streaks.alcoholFreeDays}
            color="text-pens-cream"
          />
          <StreakCard
            label="Cocaine-free"
            days={props.streaks.cocaineFreeDays}
            color="text-pens-cream"
          />
          <StreakCard
            label="Escort-free"
            days={props.streaks.escortFreeDays}
            color="text-pens-cream"
          />
        </div>
        <div className="mt-2 rounded-xl border border-pens-crimson/30 bg-pens-crimson/10 p-3 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-pens-crimson/80">
            All three clean
          </div>
          <div className="font-[family-name:var(--font-newsreader)] text-3xl font-bold mt-0.5 tabular-nums">
            {props.streaks.compoundCleanDays}
          </div>
          <div className="text-[11px] text-pens-cream/60 mt-1">
            Next milestone:{' '}
            <span className="text-pens-cream">
              {props.milestone.compound.target} days
            </span>{' '}
            ({props.milestone.compound.daysLeft} to go)
          </div>
        </div>
      </section>

      {/* — PHASE PROGRESS — */}
      {props.phase.dayNumber > 0 && (
        <section className="px-5 pt-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-pens-cream/50 mb-1">
            Phase 1 reset · day {props.phase.dayNumber} / {props.phase.total}
          </div>
          <div className="h-1.5 bg-pens-cream/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-pens-gold transition-all"
              style={{ width: `${props.phase.progress * 100}%` }}
            />
          </div>
        </section>
      )}

      {/* — TODAY'S CHECK-IN — */}
      <section className="px-5 pt-7">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/60 mb-3">
          Today
        </h2>

        {/* Hard flags: drinks / cocaine / escort */}
        <div className="space-y-2">
          {/* Alcohol stepper */}
          <div className="flex items-center justify-between rounded-xl bg-pens-surface/40 border border-pens-cream/10 p-3">
            <div>
              <div className="text-sm font-medium">Alcohol</div>
              <div className="text-xs text-pens-cream/50">
                {entry.alcoholDrinks === 0 ? 'Clean today' : `${entry.alcoholDrinks} drink${entry.alcoholDrinks === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StepBtn
                onClick={() => save({ alcoholDrinks: Math.max(0, entry.alcoholDrinks - 1) })}
              >−</StepBtn>
              <div className="w-8 text-center text-lg font-bold tabular-nums">
                {entry.alcoholDrinks}
              </div>
              <StepBtn
                onClick={() => save({ alcoholDrinks: entry.alcoholDrinks + 1 })}
              >+</StepBtn>
            </div>
          </div>

          <ToggleRow
            label="Cocaine"
            value={entry.cocaineUsed}
            onChange={v => save({ cocaineUsed: v })}
          />
          <ToggleRow
            label="Escort"
            value={entry.escortUsed}
            onChange={v => save({ escortUsed: v })}
          />
        </div>

        {/* Mood / energy / sleep */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <ScaleField
            label="Mood"
            value={entry.mood}
            onChange={v => save({ mood: v })}
          />
          <ScaleField
            label="Energy"
            value={entry.energy}
            onChange={v => save({ energy: v })}
          />
        </div>
        <div className="mt-2">
          <div className="rounded-xl bg-pens-surface/40 border border-pens-cream/10 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Sleep last night</div>
              <input
                type="number"
                step="0.25"
                min="0"
                max="14"
                value={entry.sleepHours ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  setEntry({ ...entry, sleepHours: v })
                }}
                onBlur={() => save({ sleepHours: entry.sleepHours })}
                placeholder="hours"
                className="w-20 text-right bg-transparent border-b border-pens-cream/20 focus:border-pens-cream/60 outline-none text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Supplements */}
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/50 mb-2">
            Supplements
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPLEMENTS.map(s => {
              const on = entry.supplements.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSupplement(s)}
                  className={
                    'px-3 py-1.5 rounded-full text-xs border transition-colors ' +
                    (on
                      ? 'bg-pens-gold text-pens-deep border-pens-gold'
                      : 'border-pens-cream/20 text-pens-cream/70 hover:border-pens-cream/40')
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <textarea
            value={entry.notes ?? ''}
            onChange={e => setEntry({ ...entry, notes: e.target.value })}
            onBlur={() => save({ notes: entry.notes })}
            placeholder="One sentence — how was today?"
            className="w-full bg-pens-surface/40 border border-pens-cream/10 rounded-xl p-3 text-sm placeholder:text-pens-cream/30 focus:border-pens-cream/30 outline-none resize-none"
            rows={2}
          />
        </div>
      </section>

      {/* — 14-DAY STRIP — */}
      <section className="px-5 pt-7">
        <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/50 mb-2">
          Last 14 days
        </div>
        <div className="flex gap-1">
          {build14Days(props.today, props.recentEntries).map(d => (
            <DayPip key={d.date} {...d} />
          ))}
        </div>
      </section>

      {/* — CRAVING LOG SUMMARY — */}
      <section className="px-5 pt-7">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-pens-cream/50">
            Recent cravings
          </div>
          <Link
            href="/anchor/craving"
            className="text-[11px] uppercase tracking-[0.15em] text-pens-gold/80 hover:text-pens-gold"
          >
            Log →
          </Link>
        </div>
        {props.recentCravings.length === 0 ? (
          <div className="text-xs text-pens-cream/40 italic">
            No cravings logged yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {props.recentCravings.slice(0, 5).map(c => (
              <div
                key={c.id}
                className="text-xs flex items-center gap-2 py-1.5 px-3 rounded-lg bg-pens-surface/30 border border-pens-cream/5"
              >
                <span
                  className={
                    'inline-block w-2 h-2 rounded-full ' +
                    (c.outcome === 'resisted'
                      ? 'bg-pens-gold'
                      : c.outcome === 'partial'
                        ? 'bg-pens-cream/50'
                        : 'bg-pens-crimson')
                  }
                />
                <span className="flex-1">
                  {c.target} · {c.action.replace('_', ' ')}
                </span>
                <span className="text-pens-cream/40">{fmtTime(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* — EXPORT FOR PSYCHIATRIST — */}
      <section className="px-5 pt-7">
        <Link
          href="/anchor/export"
          className="block text-center w-full rounded-xl border border-pens-cream/20 py-3 text-sm text-pens-cream/80 hover:border-pens-cream/40 hover:text-pens-cream"
        >
          Export 30-day report (for Dr. Vanderhenst)
        </Link>
      </section>

      {pending && (
        <div className="fixed top-3 right-3 text-[10px] uppercase tracking-wider text-pens-cream/50">
          saving…
        </div>
      )}

      {/* — FLOATING CRAVING BUTTON — */}
      <Link
        href="/anchor/craving"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-7 py-4 rounded-full bg-pens-crimson text-pens-cream font-bold tracking-wide text-sm shadow-2xl shadow-pens-crimson/40 hover:bg-pens-crimson/90 active:scale-95 transition-transform"
      >
        I’M HAVING A CRAVING
      </Link>
    </main>
  )
}

// ============================================================================
function greetingFor(date: string): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night.'
  if (h < 12) return 'Morning.'
  if (h < 18) return 'Afternoon.'
  return 'Evening.'
}

function StreakCard({ label, days, color }: { label: string; days: number; color: string }) {
  return (
    <div className="rounded-xl bg-pens-surface/40 border border-pens-cream/10 p-3 text-center">
      <div className="text-[10px] uppercase tracking-[0.18em] text-pens-cream/50">
        {label}
      </div>
      <div className={`font-[family-name:var(--font-newsreader)] text-2xl font-bold mt-0.5 tabular-nums ${color}`}>
        {days}
      </div>
    </div>
  )
}

function StepBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-full bg-pens-cream/10 hover:bg-pens-cream/20 text-pens-cream font-bold flex items-center justify-center"
      type="button"
    >
      {children}
    </button>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={
        'w-full flex items-center justify-between rounded-xl p-3 border transition-colors ' +
        (value
          ? 'bg-pens-crimson/15 border-pens-crimson/40'
          : 'bg-pens-surface/40 border-pens-cream/10')
      }
    >
      <div>
        <div className="text-sm font-medium text-left">{label}</div>
        <div className="text-xs text-left text-pens-cream/50">
          {value ? 'Used today' : 'Clean today'}
        </div>
      </div>
      <div
        className={
          'w-12 h-7 rounded-full relative transition-colors ' +
          (value ? 'bg-pens-crimson' : 'bg-pens-cream/15')
        }
      >
        <div
          className={
            'absolute top-0.5 w-6 h-6 rounded-full bg-pens-cream shadow transition-all ' +
            (value ? 'left-[22px]' : 'left-0.5')
          }
        />
      </div>
    </button>
  )
}

function ScaleField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl bg-pens-surface/40 border border-pens-cream/10 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-pens-cream/50 mb-1.5">
        {label}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={
              'flex-1 h-8 rounded-md text-xs font-bold transition-colors ' +
              (value === n
                ? 'bg-pens-gold text-pens-deep'
                : 'bg-pens-cream/5 text-pens-cream/50 hover:bg-pens-cream/10')
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function build14Days(
  today: string,
  recent: RecentEntry[],
): Array<{ date: string; status: 'clean' | 'alcohol' | 'cocaine' | 'escort' | 'unknown' | 'future' }> {
  const map = new Map(recent.map(e => [e.date, e]))
  const out: Array<{ date: string; status: 'clean' | 'alcohol' | 'cocaine' | 'escort' | 'unknown' | 'future' }> = []
  // Walk backwards 14 days from today.
  const [y, m, d] = today.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(base)
    dt.setDate(dt.getDate() - i)
    const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    const e = map.get(ds)
    let status: 'clean' | 'alcohol' | 'cocaine' | 'escort' | 'unknown' | 'future' = 'unknown'
    if (e) {
      if (e.cocaineUsed) status = 'cocaine'
      else if (e.escortUsed) status = 'escort'
      else if (e.alcoholDrinks > 0) status = 'alcohol'
      else status = 'clean'
    }
    out.push({ date: ds, status })
  }
  return out
}

function DayPip({ status }: { date: string; status: string }) {
  const colorClass =
    status === 'clean'
      ? 'bg-pens-gold'
      : status === 'alcohol'
        ? 'bg-pens-cream/40'
        : status === 'cocaine' || status === 'escort'
          ? 'bg-pens-crimson'
          : 'bg-pens-cream/10'
  return <div className={`flex-1 h-6 rounded-sm ${colorClass}`} />
}
