/**
 * Continental Editorial — reusable primitives for the "Modern Clubroom" system.
 * Spec: docs/design/continental/DESIGN.md
 *
 * House rules encoded here so screens can't drift:
 *  - 0px radius everywhere. No rounded corners, ever.
 *  - No 1px section borders and no <hr>. Depth comes from surface tiers only.
 *  - Oxblood (ct-blood / ct-bloodc) is surgical: errors and the single top CTA.
 *  - Every icon carries a label. Newsreader displays, Space Grotesk instruments.
 */
import type { ReactNode } from 'react'

/* ── type helpers ─────────────────────────────────────────────── */

export function Display({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={`font-headline text-[2.75rem] leading-[0.95] tracking-[-0.02em] text-ct-primary ${className}`}
    >
      {children}
    </h1>
  )
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-grotesk text-[0.625rem] uppercase tracking-[0.22em] text-ct-second/70 ${className}`}>
      {children}
    </p>
  )
}

/* ── layout ───────────────────────────────────────────────────── */

/** Tonal band. Sections separate by shifting tier, never by a rule. */
export function Band({
  tier = 'low',
  className = '',
  children,
}: {
  tier?: 'lowest' | 'low' | 'high' | 'highest'
  className?: string
  children: ReactNode
}) {
  const bg = {
    lowest: 'bg-ct-lowest',
    low: 'bg-ct-low',
    high: 'bg-ct-high',
    highest: 'bg-ct-highest',
  }[tier]
  return <section className={`${bg} px-6 py-9 ${className}`}>{children}</section>
}

/** Card nested one tier above its band — "structural gravity" without strokes. */
export function Card({
  tier = 'high',
  className = '',
  children,
}: {
  tier?: 'high' | 'highest' | 'blood'
  className?: string
  children: ReactNode
}) {
  const bg = { high: 'bg-ct-high', highest: 'bg-ct-highest', blood: 'bg-ct-bloodc' }[tier]
  return <div className={`${bg} p-6 ${className}`}>{children}</div>
}

/* ── data display ─────────────────────────────────────────────── */

/**
 * One P.E.N.S. metric. `binding` names the real code path that fills it —
 * rendered in specimen mode so a screen can never quietly ship unbound.
 */
export function Metric({
  label,
  value,
  unit,
  note,
  tone = 'neutral',
  binding,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: 'neutral' | 'blood'
  binding?: string
}) {
  return (
    <div className="mb-8 last:mb-0">
      <Kicker>{label}</Kicker>
      <p className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-headline text-6xl leading-none tracking-[-0.02em] ${
            tone === 'blood' ? 'text-ct-blood' : 'text-ct-primary'
          }`}
        >
          {value}
        </span>
        {unit && <span className="font-grotesk text-sm text-ct-second/60">{unit}</span>}
      </p>
      {note && <p className="mt-3 max-w-[36ch] text-[0.8rem] leading-relaxed text-ct-second/70">{note}</p>}
      {binding && <Binding path={binding} />}
    </div>
  )
}

/** Provenance chip: which module actually computes this number. */
export function Binding({ path }: { path: string }) {
  return (
    <p className="mt-2 font-mono text-[0.5625rem] tracking-[0.04em] text-ct-second/45">↳ {path}</p>
  )
}

/** Ledger row — replaces the banned divider with alternating tiers. */
export function LedgerRow({
  label,
  sub,
  value,
  tone = 'neutral',
  index = 0,
}: {
  label: string
  sub?: string
  value: string
  tone?: 'neutral' | 'blood'
  index?: number
}) {
  return (
    <div className={`flex items-start justify-between gap-6 px-5 py-4 ${index % 2 ? 'bg-ct-high' : 'bg-ct-highest'}`}>
      <div>
        <p className="font-grotesk text-xs uppercase tracking-[0.14em] text-ct-primary">{label}</p>
        {sub && <p className="mt-1 text-[0.7rem] leading-snug text-ct-second/60">{sub}</p>}
      </div>
      <p
        className={`shrink-0 font-headline text-xl leading-none ${
          tone === 'blood' ? 'text-ct-bloodon' : 'text-ct-primary'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

/** Sharp, full-bleed CTA. Primary = brushed steel, blood = the one high-stakes action. */
export function Action({
  children,
  tone = 'primary',
}: {
  children: ReactNode
  tone?: 'primary' | 'blood' | 'ghost'
}) {
  const styles = {
    primary: 'bg-gradient-to-br from-ct-primary to-[#242724] text-ct-on',
    blood: 'bg-ct-blood text-ct-bloodc',
    ghost: 'bg-ct-highest text-ct-second/70',
  }[tone]
  return (
    <button
      type="button"
      className={`w-full px-6 py-4 font-grotesk text-xs uppercase tracking-[0.28em] ${styles}`}
    >
      {children}
    </button>
  )
}

/* ── chrome ───────────────────────────────────────────────────── */

export function Masthead({ caseId }: { caseId?: string }) {
  return (
    <header className="bg-ct-lowest px-6 pb-5 pt-7">
      <p className="font-headline text-lg uppercase leading-tight tracking-[0.16em] text-ct-primary">
        The
        <br />
        Continental
        <br />
        P.E.N.S.
      </p>
      {caseId && <p className="mt-4 font-grotesk text-[0.625rem] uppercase tracking-[0.2em] text-ct-outline">{caseId}</p>}
    </header>
  )
}

export const PENS_TABS = [
  { id: 'performance', label: 'Performance', route: '/training' },
  { id: 'endurance', label: 'Endurance', route: '(none)' },
  { id: 'nutrition', label: 'Nutrition', route: '/food' },
  { id: 'sleep', label: 'Sleep', route: '/sleep' },
  { id: 'audit', label: 'Audit', route: '/verdict' },
] as const

export function BottomNav({ active }: { active: (typeof PENS_TABS)[number]['id'] }) {
  return (
    <nav className="sticky bottom-0 flex bg-ct-highest/80 backdrop-blur-[20px]">
      {PENS_TABS.map(t => (
        <span
          key={t.id}
          className={`flex-1 px-1 py-4 text-center font-grotesk text-[0.5rem] uppercase tracking-[0.12em] ${
            t.id === active ? 'bg-ct-bright text-ct-primary' : 'text-ct-second/50'
          }`}
        >
          {t.label}
        </span>
      ))}
    </nav>
  )
}

/** Unmissable specimen marker — values on this screen are not measurements. */
export function SpecimenBar() {
  return (
    <div className="bg-ct-bloodc px-6 py-3">
      <p className="font-grotesk text-[0.625rem] uppercase leading-relaxed tracking-[0.16em] text-ct-blood">
        Specimen layout · every figure below is a placeholder, not a measurement
      </p>
    </div>
  )
}
