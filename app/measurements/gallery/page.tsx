'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Row {
  id: string
  date: string
  photoPath: string | null
}

export default function MeasurementGalleryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/measurements?limit=120')
      const data = r.ok ? await r.json() : []
      const list = (Array.isArray(data) ? data : []) as Row[]
      setRows(list.filter((x) => Boolean(x.photoPath)))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/measurements" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Measurement photos</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">Progress shots attached to body logs</p>
            </div>
          </div>
          <Link href="/measurements" className="text-sm text-pens-gold hover:text-pens-cream transition-colors">
            Back to measurements →
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-pens-cream/45">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-pens-muted/30 bg-pens-navy/80 p-8 text-center text-pens-cream/50 text-sm">
            No photos yet. Add one from the measurements form.
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {rows.map((e) => (
              <li
                key={e.id}
                className="relative aspect-square rounded-xl overflow-hidden border border-pens-muted/30 bg-pens-navy/60 shadow-lg"
              >
                <Image
                  src={e.photoPath!}
                  alt={`Progress ${e.date}`}
                  fill
                  sizes="(max-width:768px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                  <p className="text-[10px] font-mono text-pens-cream/90">{e.date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
