'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { rollingWindow } from '@/lib/timeWindow'

export interface SleepEntryRow {
  id: string
  date: string
  hours: number
  bedtime: string
  wakeTime: string
  quality: number | null
}

const inputCls =
  'w-28 bg-pens-deep border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:ring-1 focus:ring-pens-gold focus:border-pens-gold [color-scheme:dark]'

type ChartPt = {
  date: string
  label: string
  actual: number
  target: number
  debt: number
}

/** Human-readable ± duration from fractional hours */
function signedHoursLabel(hours: number): string {
  if (Math.abs(hours) < 1e-4) return '0m'
  const sign = hours < 0 ? '-' : ''
  const abs = Math.abs(hours)
  const h = Math.floor(abs + 1e-6)
  let m = Math.round((abs - h) * 60)
  let hh = h
  if (m === 60) {
    m = 0
    hh += 1
  }
  const parts: string[] = []
  if (hh > 0) parts.push(`${hh}h`)
  if (m > 0) parts.push(`${m}m`)
  return `${sign}${parts.join(' ') || '0m'}`
}

function summaryTone(cumulativeDebt: number): string {
  if (cumulativeDebt < -1e-6) return 'text-emerald-400'
  if (cumulativeDebt > 5) return 'text-red-400'
  if (cumulativeDebt >= 2) return 'text-amber-400'
  return 'text-emerald-400'
}

function barFill(debt: number): string {
  if (debt < -1e-6) return '#34d399'
  if (debt <= 2) return '#fb923c'
  return '#f87171'
}

function DebtTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ChartPt }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ChartPt
  const dateNice = new Date(row.date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const gapLabel =
    row.debt >= 1e-6
      ? `Debt ${signedHoursLabel(row.debt)}`
      : row.debt <= -1e-6
        ? `Surplus ${signedHoursLabel(Math.abs(row.debt))}`
        : 'Balanced'

  return (
    <div className="rounded-xl border border-pens-muted/40 bg-[#1b263b] px-3 py-2.5 text-xs text-pens-cream shadow-lg">
      <p className="font-semibold mb-2 text-pens-cream border-b border-pens-muted/30 pb-1.5">{dateNice}</p>
      <p className="text-pens-cream/80">
        Actual sleep: <strong className="text-pens-cream">{row.actual.toFixed(2)} h</strong>
      </p>
      <p className="text-pens-cream/80">
        Target: <strong className="text-pens-cream">{row.target.toFixed(1)} h</strong>
      </p>
      <p className={`mt-1.5 ${row.debt > 1e-6 ? 'text-amber-200' : row.debt < -1e-6 ? 'text-emerald-300' : 'text-pens-cream/50'}`}>
        {gapLabel}
      </p>
      {row.actual === 0 && (
        <p className="text-pens-cream/40 mt-2 italic border-t border-pens-muted/20 pt-2">No sleep entry — counted as 0 h.</p>
      )}
    </div>
  )
}

interface Props {
  entries: SleepEntryRow[]
}

export default function SleepDebt({ entries }: Props) {
  const [savedTarget, setSavedTarget] = useState(7.5)
  const [draftTarget, setDraftTarget] = useState(7.5)
  const [targetLoaded, setTargetLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/sleep/target')
      .then(r => r.json())
      .then(d => {
        if (typeof d.targetHours === 'number' && !Number.isNaN(d.targetHours)) {
          setSavedTarget(d.targetHours)
          setDraftTarget(d.targetHours)
        }
        setTargetLoaded(true)
      })
      .catch(() => setTargetLoaded(true))
  }, [])

  const persistTarget = useCallback(async (raw: number) => {
    const clamped = Math.min(10, Math.max(5, raw))
    setDraftTarget(clamped)
    setSavedTarget(clamped)
    const res = await fetch('/api/sleep/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetHours: clamped }),
    })
    const d = await res.json().catch(() => ({}))
    if (typeof d.targetHours === 'number') {
      setSavedTarget(d.targetHours)
      setDraftTarget(d.targetHours)
    }
  }, [])

  const entryByDate = useMemo(() => {
    const map = new Map<string, SleepEntryRow>()
    for (const e of entries) map.set(e.date, e)
    return map
  }, [entries])

  const { chartRows, cumulativeDebt, clearInNights } = useMemo(() => {
    const calendar = rollingWindow(30).dates
    const rows: ChartPt[] = calendar.map(date => {
      const e = entryByDate.get(date)
      const actual = e ? e.hours : 0
      const debtRaw = draftTarget - actual
      const label = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
      return {
        date,
        label,
        actual,
        target: draftTarget,
        debt: parseFloat(debtRaw.toFixed(2)),
      }
    })

    let cum = 0
    for (const r of rows) cum += r.debt

    const clear = cum > 1e-6 ? Math.ceil(cum / 0.5) : 0
    const cumulativeDebt = parseFloat(cum.toFixed(2))

    return { chartRows: rows, cumulativeDebt, clearInNights: clear }
  }, [entryByDate, draftTarget])

  const tone = summaryTone(cumulativeDebt)

  const summarySentence = (() => {
    if (!targetLoaded) return '…'
    if (Math.abs(cumulativeDebt) < 1e-4)
      return 'Balanced — no net debt vs target across these 30 nights'
    const hm = signedHoursLabel(Math.abs(cumulativeDebt)).replace(/^-/, '')
    if (cumulativeDebt > 1e-6) return `${hm} in debt`
    return `${hm} surplus`
  })()

  return (
    <section className="rounded-2xl bg-pens-navy/80 border border-pens-muted/30 shadow-lg p-6 w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-pens-gold mb-1">Sleep Debt</p>
          <h2 className="text-xl font-semibold text-pens-cream">Rolling 30-night balance</h2>
          <p className="text-xs text-pens-cream/45 mt-1">
            Nights without a log count as <span className="text-pens-cream/65">0h sleep</span> (full nightly gap vs target).
          </p>
        </div>
        <div>
          <label htmlFor="sleep-debt-target" className="block text-xs font-medium text-pens-cream/55 mb-1">
            Nightly target (h)
          </label>
          <input
            id="sleep-debt-target"
            type="number"
            min={5}
            max={10}
            step={0.5}
            value={targetLoaded ? draftTarget : 7.5}
            disabled={!targetLoaded}
            onChange={e => setDraftTarget(Number(e.target.value))}
            onBlur={e => {
              const n = Number(e.target.value)
              if (Number.isNaN(n)) {
                setDraftTarget(savedTarget)
              } else {
                void persistTarget(n)
              }
            }}
            className={inputCls}
          />
        </div>
      </div>

      <div className="rounded-xl bg-pens-deep/50 border border-pens-muted/25 px-4 py-4">
        <p className={`text-lg font-semibold ${tone}`}>{summarySentence}</p>
        {clearInNights > 0 && cumulativeDebt > 1e-6 && (
          <p className="text-sm text-pens-cream/50 mt-2">
            Clear in ~<span className="text-pens-cream font-medium">{clearInNights}</span> nights of{' '}
            <span className="text-pens-gold">+30 min</span> vs target each night (approx.)
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-pens-cream/65 mb-3">Daily gap vs target</h3>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D405B80" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#F5E6D366' }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={{ fontSize: 10, fill: '#F5E6D350' }} width={36} />
              <ReferenceLine y={0} stroke="#f5e6d360" strokeWidth={1} />
              <Tooltip cursor={{ fill: 'rgba(245,230,211,0.06)' }} content={<DebtTooltip />} />
              <Bar dataKey="debt" radius={[4, 4, 2, 2]} name="gap">
                {chartRows.map((r, i) => (
                  <Cell key={`${r.date}-${i}`} fill={barFill(r.debt)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
