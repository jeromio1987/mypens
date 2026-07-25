'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FlaskConical, Plus, Trash2, Save } from 'lucide-react'
import {
  FLAG_CHIP,
  flagRefRange,
  softBloodworkRead,
  type RefFlag,
} from '@/lib/bloodworkFlags'
import { schildklierRead } from '@/lib/bloodworkThyroidRead'
import { longevityHintsForCodes } from '@/lib/bloodworkLongevityHints'

type Marker = {
  id?: string
  code: string
  label: string
  valueNum: string
  valueText: string
  unit: string
  refLow: string
  refHigh: string
}

type Panel = {
  id: string
  drawDate: string
  labName: string | null
  fasting: boolean
  notes: string | null
  markers: Array<{
    id: string
    code: string
    label: string
    valueNum: number | null
    valueText: string | null
    unit: string | null
    refLow: number | null
    refHigh: number | null
    sortOrder: number
  }>
}

type ContextResp =
  | { enabled: false; reason?: string }
  | {
      enabled: true
      drawDate: string
      windowDays: number
      disclaimer: string
      sleepNightsLogged: number
      avgSleepHours: number | null
      hrvNightsLogged: number
      avgHrvMs: number | null
      trainingSessions: number
      trainingVolumeSum: number
    }

function emptyRow(): Marker {
  return {
    code: '',
    label: '',
    valueNum: '',
    valueText: '',
    unit: '',
    refLow: '',
    refHigh: '',
  }
}

function fromServer(m: Panel['markers'][0]): Marker {
  return {
    id: m.id,
    code: m.code,
    label: m.label,
    valueNum: m.valueNum != null ? String(m.valueNum) : '',
    valueText: m.valueText ?? '',
    unit: m.unit ?? '',
    refLow: m.refLow != null ? String(m.refLow) : '',
    refHigh: m.refHigh != null ? String(m.refHigh) : '',
  }
}

export default function BloodworkPanelClient() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const [panel, setPanel] = useState<Panel | null>(null)
  const [rows, setRows] = useState<Marker[]>([emptyRow()])
  const [metaLab, setMetaLab] = useState('')
  const [metaFasting, setMetaFasting] = useState(false)
  const [metaNotes, setMetaNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ctx, setCtx] = useState<ContextResp | null>(null)
  const [longevityOn, setLongevityOn] = useState(false)

  const loadPanel = useCallback(() => {
    if (!id) return
    fetch(`/api/bloodwork/panels/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((p: Panel) => {
        setPanel(p)
        setMetaLab(p.labName ?? '')
        setMetaFasting(p.fasting)
        setMetaNotes(p.notes ?? '')
        setRows(p.markers.length ? p.markers.map(fromServer) : [emptyRow()])
      })
      .catch(() => setPanel(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  useEffect(() => {
    if (!id) return
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.labsLongevityLensEnabled === 'boolean') {
          setLongevityOn(d.labsLongevityLensEnabled)
        }
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !panel) return
    fetch(`/api/bloodwork/panels/${id}/context`)
      .then(r => r.json())
      .then((d: ContextResp) => setCtx(d))
      .catch(() => setCtx(null))
  }, [id, panel?.drawDate])

  const saveMeta = async () => {
    if (!id) return
    await fetch(`/api/bloodwork/panels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labName: metaLab.trim() || null,
        fasting: metaFasting,
        notes: metaNotes.trim() || null,
      }),
    })
    loadPanel()
  }

  const saveMarkers = async () => {
    if (!id) return
    setSaving(true)
    const markers = rows
      .filter(r => r.code.trim() && r.label.trim())
      .map((r, i) => {
        const vn = r.valueNum === '' ? null : parseFloat(r.valueNum)
        const rl = r.refLow === '' ? null : parseFloat(r.refLow)
        const rh = r.refHigh === '' ? null : parseFloat(r.refHigh)
        return {
          code: r.code.trim(),
          label: r.label.trim(),
          valueNum: vn != null && Number.isFinite(vn) ? vn : null,
          valueText: r.valueText.trim() || null,
          unit: r.unit.trim() || null,
          refLow: rl != null && Number.isFinite(rl) ? rl : null,
          refHigh: rh != null && Number.isFinite(rh) ? rh : null,
          sortOrder: i,
        }
      })
    try {
      const res = await fetch(`/api/bloodwork/panels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markers }),
      })
      if (!res.ok) throw new Error('save failed')
      const p: Panel = await res.json()
      setPanel(p)
      setRows(p.markers.length ? p.markers.map(fromServer) : [emptyRow()])
    } catch {
      /* noop */
    }
    setSaving(false)
  }

  const deletePanel = async () => {
    if (!id || !confirm('Delete this panel and all markers?')) return
    await fetch(`/api/bloodwork/panels/${id}`, { method: 'DELETE' })
    router.push('/bloodwork')
  }

  const hints = longevityOn ? longevityHintsForCodes(rows.map(r => r.code).filter(Boolean)) : []
  const softRead = softBloodworkRead(
    rows
      .filter(r => r.code.trim() || r.label.trim())
      .map(r => {
        const vn = r.valueNum === '' ? null : parseFloat(r.valueNum)
        const rl = r.refLow === '' ? null : parseFloat(r.refLow)
        const rh = r.refHigh === '' ? null : parseFloat(r.refHigh)
        return {
          code: r.code || r.label,
          label: r.label || r.code,
          valueNum: vn != null && Number.isFinite(vn) ? vn : null,
          refLow: rl != null && Number.isFinite(rl) ? rl : null,
          refHigh: rh != null && Number.isFinite(rh) ? rh : null,
          flag: flagRefRange(
            vn != null && Number.isFinite(vn) ? vn : null,
            rl != null && Number.isFinite(rl) ? rl : null,
            rh != null && Number.isFinite(rh) ? rh : null,
          ),
        }
      }),
    hints.map(h => h.title),
  )

  const thyroid = schildklierRead(
    rows
      .filter(r => r.code.trim() || r.label.trim())
      .map(r => {
        const vn = r.valueNum === '' ? null : parseFloat(r.valueNum)
        const rl = r.refLow === '' ? null : parseFloat(r.refLow)
        const rh = r.refHigh === '' ? null : parseFloat(r.refHigh)
        return {
          code: r.code || r.label,
          label: r.label || r.code,
          valueNum: vn != null && Number.isFinite(vn) ? vn : null,
          refLow: rl != null && Number.isFinite(rl) ? rl : null,
          refHigh: rh != null && Number.isFinite(rh) ? rh : null,
          unit: r.unit.trim() || null,
        }
      }),
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-pens-deep text-pens-cream p-8">
        <div className="max-w-4xl mx-auto h-64 rounded-xl bg-pens-surface/30 animate-pulse" />
      </main>
    )
  }

  if (!panel) {
    return (
      <main className="min-h-screen bg-pens-deep text-pens-cream p-8">
        <p className="text-pens-cream/60">Panel not found.</p>
        <Link href="/bloodwork" className="text-rose-400 text-sm mt-4 inline-block">
          ← Back
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream pb-28">
      <header className="sticky top-0 z-40 bg-pens-deep/95 backdrop-blur border-b border-pens-muted/20">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-6 py-4 gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <FlaskConical className="text-rose-400 shrink-0" size={20} />
            <h1 className="text-base font-bold truncate">Panel {panel.drawDate}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button type="button" onClick={deletePanel} className="text-xs text-red-400/80 hover:text-red-400">
              Delete
            </button>
            <Link href="/bloodwork" className="text-xs text-pens-cream/40 hover:text-pens-cream/70">
              All panels
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-pens-cream/50">Panel details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase text-pens-cream/40">Draw date</label>
              <input
                type="date"
                value={panel.drawDate}
                readOnly
                className="mt-1 w-full bg-pens-surface/40 border border-pens-muted/25 rounded-lg px-3 py-2 text-sm opacity-70 cursor-not-allowed"
              />
              <p className="text-[10px] text-pens-cream/35 mt-1">Date is fixed after create (v1).</p>
            </div>
            <div>
              <label className="text-[10px] uppercase text-pens-cream/40">Lab</label>
              <input
                type="text"
                value={metaLab}
                onChange={e => setMetaLab(e.target.value)}
                className="mt-1 w-full bg-pens-deep border border-pens-muted/30 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-pens-cream/70">
            <input type="checkbox" checked={metaFasting} onChange={e => setMetaFasting(e.target.checked)} />
            Fasting draw
          </label>
          <div>
            <label className="text-[10px] uppercase text-pens-cream/40">Notes</label>
            <textarea
              value={metaNotes}
              onChange={e => setMetaNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full bg-pens-deep border border-pens-muted/30 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={saveMeta}
            className="text-xs px-4 py-2 rounded-lg border border-pens-muted/40 hover:bg-pens-surface/40"
          >
            Save details
          </button>
        </section>

        {ctx && ctx.enabled && (
          <section className="rounded-2xl border border-sky-500/25 bg-sky-950/20 p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-sky-300/90">Wearable & training context</h2>
            <p className="text-xs text-pens-cream/50 leading-relaxed">{ctx.disclaimer}</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-pens-deep/50 p-3 border border-pens-muted/20">
                <p className="text-[10px] uppercase text-pens-cream/40 mb-1">Sleep nights logged</p>
                <p className="text-xl font-[family-name:var(--font-headline)] italic">{ctx.sleepNightsLogged}</p>
                <p className="text-xs text-pens-cream/45 mt-2">
                  Avg hours: {ctx.avgSleepHours != null ? ctx.avgSleepHours.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-pens-cream/45">
                  HRV nights: {ctx.hrvNightsLogged}
                  {ctx.avgHrvMs != null ? ` · avg ${ctx.avgHrvMs.toFixed(0)} ms` : ''}
                </p>
              </div>
              <div className="rounded-xl bg-pens-deep/50 p-3 border border-pens-muted/20">
                <p className="text-[10px] uppercase text-pens-cream/40 mb-1">Training (same window)</p>
                <p className="text-xl font-[family-name:var(--font-headline)] italic">{ctx.trainingSessions}</p>
                <p className="text-xs text-pens-cream/45 mt-2">Σ volume (sets×reps×kg): {ctx.trainingVolumeSum.toFixed(0)}</p>
                <p className="text-[10px] text-pens-cream/35 mt-2">
                  Window: {ctx.windowDays} days ending {ctx.drawDate}
                </p>
              </div>
            </div>
          </section>
        )}

        {ctx && !ctx.enabled && (
          <p className="text-xs text-pens-cream/40 border border-pens-muted/20 rounded-lg p-3">{ctx.reason ?? 'Context hidden.'}</p>
        )}

        <section className="rounded-2xl border border-rose-500/20 bg-pens-surface/25 p-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-300/90">Soft read</h2>
          <p className="text-sm text-pens-cream/75 leading-relaxed">{softRead.summary}</p>
          <p className="text-[10px] text-pens-cream/35 leading-relaxed">{softRead.disclaimer}</p>
        </section>

        {thyroid.present && (
          <section className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-violet-300/90">{thyroid.title}</h2>
            <p className="text-sm text-pens-cream/75 leading-relaxed">{thyroid.summary}</p>
            <ul className="flex flex-wrap gap-2">
              {thyroid.markers.map(m => {
                const chip = FLAG_CHIP[m.flag]
                return (
                  <li
                    key={m.code}
                    className={`text-[10px] px-2 py-1 rounded-md border ${chip.className}`}
                  >
                    {m.label}
                    {m.valueNum != null ? ` · ${m.valueNum}${m.unit ? ` ${m.unit}` : ''}` : ''} · {chip.label}
                  </li>
                )
              })}
            </ul>
            <p className="text-[10px] text-pens-cream/35 leading-relaxed">{thyroid.disclaimer}</p>
          </section>
        )}

        {longevityOn && hints.length > 0 && (
          <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-300/90">Longevity / prevention lens</h2>
            <ul className="space-y-3">
              {hints.map(h => (
                <li key={h.title} className="text-sm">
                  <p className="font-semibold text-pens-cream/90">{h.title}</p>
                  <p className="text-pens-cream/55 mt-1 leading-relaxed">{h.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-pens-cream/50">Markers</h2>
            <button
              type="button"
              onClick={() => setRows(r => [...r, emptyRow()])}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
            >
              <Plus size={14} /> Row
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-pens-muted/25">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="bg-pens-surface/50 text-pens-cream/50 uppercase tracking-wider">
                <tr>
                  <th className="p-2 w-24">Code</th>
                  <th className="p-2 w-36">Label</th>
                  <th className="p-2 w-20">Value</th>
                  <th className="p-2 w-24">Text</th>
                  <th className="p-2 w-16">Unit</th>
                  <th className="p-2 w-16">Ref low</th>
                  <th className="p-2 w-16">Ref hi</th>
                  <th className="p-2 w-20">Flag</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const vn = r.valueNum === '' ? null : parseFloat(r.valueNum)
                  const rl = r.refLow === '' ? null : parseFloat(r.refLow)
                  const rh = r.refHigh === '' ? null : parseFloat(r.refHigh)
                  const flag: RefFlag = flagRefRange(
                    vn != null && Number.isFinite(vn) ? vn : null,
                    rl != null && Number.isFinite(rl) ? rl : null,
                    rh != null && Number.isFinite(rh) ? rh : null,
                  )
                  const chip = FLAG_CHIP[flag]
                  return (
                  <tr key={i} className="border-t border-pens-muted/15">
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.code}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                        placeholder="ferritin"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.label}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        placeholder="Ferritin"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.valueNum}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, valueNum: e.target.value } : x)))}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.valueText}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, valueText: e.target.value } : x)))}
                        placeholder="<2"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.unit}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.refLow}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, refLow: e.target.value } : x)))}
                      />
                    </td>
                    <td className="p-1">
                      <input
                        className="w-full bg-pens-deep border border-transparent focus:border-rose-500/40 rounded px-1 py-1"
                        value={r.refHigh}
                        onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, refHigh: e.target.value } : x)))}
                      />
                    </td>
                    <td className="p-1">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${chip.className}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        className="text-pens-cream/30 hover:text-red-400 p-1"
                        aria-label="Remove row"
                        onClick={() => setRows(rs => (rs.length <= 1 ? [emptyRow()] : rs.filter((_, j) => j !== i)))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={saveMarkers}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save markers'}
          </button>
        </section>
      </div>
    </main>
  )
}
