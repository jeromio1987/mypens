'use client'

import Link from 'next/link'
import { ArrowLeft, GitCompare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Ex = { id: string; name: string; sets: number; reps: string; weightKg: number | null; order: number }
type Day = { id: string; dayLabel: string; order: number; exercises: Ex[] }
type Prog = { id: string; name: string; active: boolean; days: Day[] }

export default function ProgrammeComparePage() {
  const [list, setList] = useState<Prog[]>([])
  const [a, setA] = useState('')
  const [b, setB] = useState('')

  const load = useCallback(() => {
    fetch('/api/programmes')
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setList(rows as Prog[])
      })
      .catch(() => setList([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (list.length >= 2 && !a) setA(list[0].id)
    if (list.length >= 2 && !b) setB(list[1].id)
  }, [list, a, b])

  const pa = useMemo(() => list.find((p) => p.id === a) ?? null, [list, a])
  const pb = useMemo(() => list.find((p) => p.id === b) ?? null, [list, b])

  const diffLines = useMemo(() => {
    if (!pa || !pb) return []
    const lines: string[] = []
    const daysA = [...pa.days].sort((x, y) => x.order - y.order)
    const daysB = [...pb.days].sort((x, y) => x.order - y.order)
    const max = Math.max(daysA.length, daysB.length)
    for (let i = 0; i < max; i++) {
      const da = daysA[i]
      const db = daysB[i]
      if (!da && db) {
        lines.push(`Only in B: day slot ${i + 1} → ${db.dayLabel}`)
        continue
      }
      if (da && !db) {
        lines.push(`Only in A: day slot ${i + 1} → ${da.dayLabel}`)
        continue
      }
      if (!da || !db) continue
      if (da.dayLabel !== db.dayLabel) {
        lines.push(`Label mismatch slot ${i + 1}: “${da.dayLabel}” vs “${db.dayLabel}”`)
      }
      const exA = [...da.exercises].sort((x, y) => x.order - y.order)
      const exB = [...db.exercises].sort((x, y) => x.order - y.order)
      const n = Math.max(exA.length, exB.length)
      for (let j = 0; j < n; j++) {
        const xa = exA[j]
        const xb = exB[j]
        if (!xa && xb) {
          lines.push(`  ${da.dayLabel}: only B has exercise #${j + 1}: ${xb.name}`)
          continue
        }
        if (xa && !xb) {
          lines.push(`  ${da.dayLabel}: only A has exercise #${j + 1}: ${xa.name}`)
          continue
        }
        if (!xa || !xb) continue
        if (xa.name !== xb.name || xa.sets !== xb.sets || xa.reps !== xb.reps || xa.weightKg !== xb.weightKg) {
          lines.push(
            `  ${da.dayLabel}: ${xa.name} (${xa.sets}×${xa.reps}${xa.weightKg != null ? ` @ ${xa.weightKg}` : ''}) ≠ ${xb.name} (${xb.sets}×${xb.reps}${xb.weightKg != null ? ` @ ${xb.weightKg}` : ''})`,
          )
        }
      }
    }
    if (lines.length === 0) return ['No structural differences in ordered days/exercises (names, sets, reps, target weight).']
    return lines
  }, [pa, pb])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8 text-pens-cream">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/programmes" className="text-pens-cream/40 hover:text-pens-cream/70">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">Programmes</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitCompare size={22} className="text-orange-400" />
              Compare
            </h1>
            <p className="text-xs text-pens-cream/45 mt-1">Structural diff by day order and exercise order.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-pens-cream/50">
            Programme A
            <select
              value={a}
              onChange={(e) => setA(e.target.value)}
              className="w-full rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-3 py-2 text-sm"
            >
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-pens-cream/50">
            Programme B
            <select
              value={b}
              onChange={(e) => setB(e.target.value)}
              className="w-full rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-3 py-2 text-sm"
            >
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-pens-muted/25 bg-pens-navy/40 p-4">
          <ul className="space-y-1 text-sm text-pens-cream/80 font-mono leading-relaxed">
            {diffLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
