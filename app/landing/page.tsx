import Link from 'next/link'
import { CheckCircle, X } from 'lucide-react'

const fontHeadline = 'font-[family-name:var(--font-headline)]'

const ctaCls =
  'inline-flex items-center justify-center bg-pens-crimson text-pens-cream px-10 py-4 rounded-md font-bold uppercase tracking-widest hover:bg-red-700 transition'

const WHAT_IT_DOES = [
  'Strip water noise from weight changes',
  'Track body composition without worshipping BIA',
  'Log training volume, sessions, and progression',
  'Audit sleep quality, duration, and consistency',
  'Score your week with Verdict ledgers',
] as const

const BUILT_FOR = [
  'Slightly sporty people who track things',
  'Data nerds with lifting shoes',
  'Anyone tired of fake health certainty',
] as const

const NOT_FOR = [
  'Vibes-only wellness monks',
  'People seeking motivational mist',
] as const

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col bg-pens-deep">
        <div className="absolute left-0 top-0 h-full w-1 bg-pens-crimson" aria-hidden />
        <div className="flex flex-1 flex-col justify-center px-6 py-16 md:py-24">
          <div className="mx-auto w-full max-w-2xl">
            <h1
              className={`${fontHeadline} font-black text-5xl uppercase text-pens-cream md:text-7xl`}
            >
              Track The Signal
            </h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-pens-cream/60">
              Health tracking for people who train, log, weigh, and want the noise removed
            </p>
            <div className="mt-8">
              <Link href="/onboarding" className={ctaCls}>
                Start Tracking
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-6 pb-24">
        {/* The problem */}
        <section className="mt-16 rounded-2xl bg-pens-navy/40 p-8">
          <p className="text-pens-cream/80 leading-relaxed italic">
            Most health apps treat every scale jump like a meaningful event. MY PENS audits the noise first, because water, sodium, carbs, alcohol, travel, and hard training all like forging evidence.
          </p>
        </section>

        {/* What it does */}
        <section className="mt-16">
          <p className="mb-4 text-xs uppercase tracking-widest text-pens-crimson">What it does</p>
          <ul className="flex flex-col gap-3">
            {WHAT_IT_DOES.map(line => (
              <li
                key={line}
                className="rounded-xl border-l-2 border-pens-gold bg-pens-surface/40 px-6 py-4 text-sm text-pens-cream"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>

        {/* Built for / Not for */}
        <section className="mt-16 grid gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-pens-cream/50">
              Built for
            </p>
            <ul className="space-y-3">
              {BUILT_FOR.map(line => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-pens-cream/80">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-pens-cream/50">
              Not for
            </p>
            <ul className="space-y-3">
              {NOT_FOR.map(line => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-pens-cream/80">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-pens-crimson" strokeWidth={2.5} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The Verdict */}
        <blockquote className="mt-16">
          <span className={`${fontHeadline} block text-6xl leading-none text-pens-crimson`} aria-hidden>
            &ldquo;
          </span>
          <p className={`${fontHeadline} mt-1 text-xl italic leading-relaxed text-pens-cream`}>
            I stopped panicking at random scale jumps and started seeing which habits were actually moving the ledger
          </p>
        </blockquote>

        {/* Footer CTA */}
        <footer className="mt-24 border-t border-pens-muted/20 py-16 text-center">
          <p className="mb-6 text-pens-cream/60">Bring receipts to your health data</p>
          <Link href="/onboarding" className={ctaCls}>
            Start Tracking
          </Link>
          <p className="mt-4 text-xs text-pens-cream/30">
            No account required · Local data · Free to start
          </p>
        </footer>
      </div>
    </main>
  )
}
