import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import mockups from '@/lib/stitchMockups.json'

type Mockup = { slug: string; title: string }
type Manifest = Record<string, Mockup[]>

export const metadata = { title: 'MY PENS — Mockup Reference' }

export default function MockupsPage() {
  const manifest = mockups as Manifest
  const total = Object.values(manifest).reduce((s, g) => s + g.length, 0)

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-pens-cream/50 hover:text-pens-cream mb-4">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <p className="text-xs uppercase tracking-[0.2em] text-pens-crimson font-semibold">P.E.N.S.</p>
          <p className="text-xs text-pens-cream/40">{total} mockups</p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Mockup Reference</h1>
        <p className="text-sm text-pens-cream/50 mt-1 mb-10">
          Stitch design exports — visual reference for the continental dark aesthetic. Not interactive.
        </p>

        <div className="space-y-12">
          {Object.entries(manifest).map(([group, items]) => (
            <section key={group}>
              <div className="flex items-baseline justify-between mb-4 border-b border-pens-muted/30 pb-2">
                <h2 className="text-lg font-semibold text-pens-cream">{group}</h2>
                <span className="text-xs text-pens-cream/40">{items.length}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(m => (
                  <a
                    key={m.slug}
                    href={`/stitch/${m.slug}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl overflow-hidden border border-pens-muted/30 bg-pens-surface/60 hover:border-pens-gold/60 transition-colors"
                  >
                    <div className="relative w-full aspect-[9/16] bg-pens-deep">
                      <Image
                        src={`/stitch/${m.slug}.png`}
                        alt={m.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain group-hover:scale-[1.01] transition-transform"
                      />
                    </div>
                    <div className="px-3 py-2 border-t border-pens-muted/20">
                      <p className="text-xs text-pens-cream/80 truncate" title={m.title}>{m.title}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
