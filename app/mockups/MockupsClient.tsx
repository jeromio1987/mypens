'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

type Mockup = { slug: string; title: string }
type Manifest = Record<string, Mockup[]>
type FlatMockup = Mockup & { group: string }

interface Props { manifest: Manifest }

export default function MockupsClient({ manifest }: Props) {
  const [query, setQuery] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const flat: FlatMockup[] = useMemo(
    () => Object.entries(manifest).flatMap(([group, items]) => items.map(m => ({ ...m, group }))),
    [manifest],
  )

  const total = flat.length

  const filtered: Manifest = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return manifest
    const out: Manifest = {}
    for (const [group, items] of Object.entries(manifest)) {
      const groupHit = group.toLowerCase().includes(q)
      const matches = items.filter(m =>
        groupHit || m.title.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q),
      )
      if (matches.length) out[group] = matches
    }
    return out
  }, [manifest, query])

  const visibleFlat: FlatMockup[] = useMemo(
    () => Object.entries(filtered).flatMap(([group, items]) => items.map(m => ({ ...m, group }))),
    [filtered],
  )

  const filteredCount = visibleFlat.length

  // Build a stable global index for the lightbox over the *filtered* list.
  const slugToIdx = useMemo(() => {
    const map = new Map<string, number>()
    visibleFlat.forEach((m, i) => map.set(m.slug, i))
    return map
  }, [visibleFlat])

  // Keyboard navigation in the lightbox
  useEffect(() => {
    if (openIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null)
      else if (e.key === 'ArrowRight') setOpenIdx(i => (i === null ? null : (i + 1) % visibleFlat.length))
      else if (e.key === 'ArrowLeft')  setOpenIdx(i => (i === null ? null : (i - 1 + visibleFlat.length) % visibleFlat.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIdx, visibleFlat.length])

  // Lock scroll while modal open
  useEffect(() => {
    if (openIdx === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [openIdx])

  // Reset openIdx if the filtered list shrinks past it
  useEffect(() => {
    if (openIdx === null || openIdx < visibleFlat.length) return
    queueMicrotask(() => setOpenIdx(null))
  }, [openIdx, visibleFlat.length])

  const current = openIdx !== null ? visibleFlat[openIdx] : null

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream pb-24">
      <div className="max-w-6xl mx-auto px-6 pt-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-pens-cream/50 hover:text-pens-cream mb-4">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <p className="text-xs uppercase tracking-[0.2em] text-pens-crimson font-semibold">P.E.N.S.</p>
          <p className="text-xs text-pens-cream/40">
            {query ? `${filteredCount} of ${total}` : `${total} mockups`}
          </p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Mockup Reference</h1>
        <p className="text-sm text-pens-cream/50 mt-1 mb-6">
          Stitch design exports — visual reference for the continental dark aesthetic. Click any image to enlarge.
        </p>

        {/* Search */}
        <div className="relative mb-10 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pens-cream/30" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title, slug, or category…"
            className="w-full bg-pens-surface/60 border border-pens-muted/30 focus:border-pens-gold/60 rounded-lg pl-9 pr-9 py-2 text-sm text-pens-cream placeholder:text-pens-cream/30 focus:outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-pens-cream/40 hover:text-pens-cream p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {filteredCount === 0 ? (
          <div className="text-center py-20 text-pens-cream/40 text-sm">
            No mockups match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(filtered).map(([group, items]) => (
              <section key={group}>
                <div className="flex items-baseline justify-between mb-4 border-b border-pens-muted/30 pb-2">
                  <h2 className="text-lg font-semibold text-pens-cream">{group}</h2>
                  <span className="text-xs text-pens-cream/40">{items.length}</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(m => {
                    const globalIdx = slugToIdx.get(m.slug) ?? 0
                    const isFirst   = globalIdx === 0
                    return (
                      <button
                        key={m.slug}
                        type="button"
                        onClick={() => setOpenIdx(globalIdx)}
                        className="group block w-full text-left rounded-xl overflow-hidden border border-pens-muted/30 bg-pens-surface/60 hover:border-pens-gold/60 transition-colors cursor-zoom-in"
                      >
                        <div className="relative w-full aspect-[9/16] bg-pens-deep">
                          <Image
                            src={`/stitch/${m.slug}.png`}
                            alt={m.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            loading={isFirst ? 'eager' : 'lazy'}
                            priority={isFirst}
                            className="object-contain group-hover:scale-[1.01] transition-transform"
                          />
                        </div>
                        <div className="px-3 py-2 border-t border-pens-muted/20">
                          <p className="text-xs text-pens-cream/80 truncate" title={m.title}>{m.title}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {current && openIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-pens-deep/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpenIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">{current.group}</p>
                <p className="text-sm text-pens-cream truncate" title={current.title}>{current.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/stitch/${current.slug}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-widest text-pens-gold hover:text-pens-cream border border-pens-muted/40 hover:border-pens-gold/60 px-2.5 py-1 rounded transition-colors"
                  onClick={ev => ev.stopPropagation()}
                >
                  Open raw ↗
                </a>
                <button
                  onClick={() => setOpenIdx(null)}
                  aria-label="Close"
                  className="text-pens-cream/60 hover:text-pens-cream p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative flex-1 min-h-[60vh] bg-pens-navy rounded-xl overflow-hidden border border-pens-muted/30">
              <Image
                src={`/stitch/${current.slug}.png`}
                alt={current.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain"
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-pens-cream/40">
              <button
                type="button"
                onClick={ev => { ev.stopPropagation(); setOpenIdx(i => (i === null ? null : (i - 1 + visibleFlat.length) % visibleFlat.length)) }}
                className="flex items-center gap-1 hover:text-pens-cream transition-colors"
                aria-label="Previous mockup"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span>{openIdx + 1} of {visibleFlat.length}</span>
              <button
                type="button"
                onClick={ev => { ev.stopPropagation(); setOpenIdx(i => (i === null ? null : (i + 1) % visibleFlat.length)) }}
                className="flex items-center gap-1 hover:text-pens-cream transition-colors"
                aria-label="Next mockup"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
