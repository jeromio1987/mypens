'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DESTINATIONS, MORE_LINKS } from '@/lib/destinations'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import SyncStatusBadge from '@/components/shared/SyncStatusBadge'
import { Kicker } from '@/components/continental/kit'

/** WP 3.3 — four-destination chrome in Continental surface tiers (0 radius). */
export default function DestinationsChrome({
  children,
  active,
}: {
  children: React.ReactNode
  active?: 'read' | 'fueling' | 'train' | 'audit'
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const current =
    active ??
    (DESTINATIONS.find(d => pathname === d.href || pathname.startsWith(d.href + '/'))?.id ?? null)
  const currentDest = DESTINATIONS.find(d => d.id === current)

  return (
    <div className="min-h-screen bg-ct-lowest text-ct-primary">
      <header className="sticky top-0 z-40 bg-ct-lowest/95 backdrop-blur-[20px]">
        <div className="max-w-screen-xl mx-auto px-5 pt-6 pb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker>The Continental · P.E.N.S.</Kicker>
            <Link
              href="/period-review"
              className="mt-2 block font-headline text-2xl uppercase leading-none tracking-[0.12em] text-ct-primary"
            >
              Auditor
            </Link>
            {currentDest ? (
              <p className="mt-2 max-w-[36ch] font-grotesk text-[0.7rem] leading-snug text-ct-second/55">
                {currentDest.blurb}
              </p>
            ) : null}
          </div>
          <nav className="flex flex-wrap items-stretch gap-0">
            {DESTINATIONS.map(d => {
              const on = current === d.id
              return (
                <Link
                  key={d.id}
                  href={d.href}
                  className={`px-3 py-3 font-grotesk text-[0.625rem] uppercase tracking-[0.18em] transition-colors ${
                    on
                      ? 'bg-ct-bright text-ct-primary'
                      : 'bg-ct-low text-ct-second/45 hover:text-ct-primary hover:bg-ct-high'
                  }`}
                >
                  {d.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              className="flex items-center gap-1 px-3 py-3 font-grotesk text-[0.625rem] uppercase tracking-[0.18em] bg-ct-low text-ct-second/45 hover:text-ct-primary"
            >
              Meer
              <ChevronDown size={12} className={moreOpen ? 'rotate-180' : ''} />
            </button>
          </nav>
        </div>
        {moreOpen && (
          <div className="bg-ct-low">
            <div className="max-w-screen-xl mx-auto px-5 py-4 flex flex-wrap gap-2">
              {MORE_LINKS.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-grotesk text-[0.65rem] uppercase tracking-[0.14em] text-ct-second/55 hover:text-ct-primary bg-ct-high px-3 py-2"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="max-w-screen-xl mx-auto px-5 pb-4">
          <SyncStatusBadge />
        </div>
      </header>
      <main className="bg-ct-low min-h-[60vh]">{children}</main>
    </div>
  )
}
