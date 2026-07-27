'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Source = {
  id: string
  label: string
  kcal: number
  origin: string
  detail?: string
}

type DeviceRef = {
  steps: number | null
  activeKcal: number | null
  restingKcal: number | null
  totalKcal: number | null
  note: string
}

type Balance = {
  date: string
  foodKcal: number
  eatKcal: number
  neatKcal: number
  bmrKcal: number
  bmrLabel: string
  activityKcal: number
  estimatedOut: number
  delta: number
  incompleteCapture: boolean
  foodIncomplete?: boolean
  neatSource?: string
  sources: Source[]
  neatDetail?: string
  deviceRef: DeviceRef | null
  disclaimer: string
}

export default function EnergyBalanceCard({ date, refresh = 0 }: { date: string; refresh?: number }) {
  const [data, setData] = useState<Balance | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    fetch(`/api/energy-balance?date=${encodeURIComponent(date)}`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setData(j)
      })
      .catch(e => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed')
      })
    return () => { cancelled = true }
  }, [date, refresh])

  if (err) {
    return (
      <div className="bg-ct-bloodc px-5 py-4 text-sm text-ct-blood">
        Energy balance: {err}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="bg-ct-high px-5 py-4 text-sm text-ct-second/45">
        Loading energy ledger…
      </div>
    )
  }

  const surplus = data.delta >= 0
  const sessionSources = data.sources.filter(s =>
    s.origin === 'garmin_activity' || s.origin === 'training' || s.origin === 'notes' || s.origin === 'pushed',
  )
  const steps = data.deviceRef?.steps
  const neatUnknown = data.neatSource === 'none'
  const eatUnknown = data.incompleteCapture && !data.foodIncomplete && data.eatKcal === 0
  const hideDelta = data.incompleteCapture

  const ENERGY_BMR = '#64748b'
  const ENERGY_EAT = '#fb923c'
  const ENERGY_NEAT = '#2dd4bf'
  const ENERGY_FOOD = '#E8B84A'
  const bmr = Math.max(0, data.bmrKcal)
  const eat = eatUnknown ? 0 : Math.max(0, data.eatKcal)
  const neat = neatUnknown ? 0 : Math.max(0, data.neatKcal)
  const food = Math.max(0, data.foodKcal)
  const outTotal = bmr + eat + neat
  const maxBar = Math.max(outTotal, food, 1)

  const StackCol = ({
    label,
    total,
    segments,
    accentLabel,
  }: {
    label: string
    total: number
    segments: { kcal: number; color: string; key: string }[]
    accentLabel?: boolean
  }) => (
    <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
      <p
        className={`text-[11px] tabular-nums font-semibold ${
          accentLabel ? 'text-ct-blood' : 'text-ct-second/55'
        }`}
      >
        {total > 0 ? total : '—'}
      </p>
      <div
        className="w-full max-w-[88px] h-44 bg-ct-lowest overflow-hidden flex flex-col-reverse"
        title={label}
      >
        {segments
          .filter(s => s.kcal > 0)
          .map(s => (
            <div
              key={s.key}
              style={{
                height: `${Math.max(2, (s.kcal / maxBar) * 100)}%`,
                backgroundColor: s.color,
              }}
              className="w-full"
            />
          ))}
      </div>
      <p className="font-grotesk text-[0.65rem] uppercase tracking-[0.14em] text-ct-second/60">{label}</p>
    </div>
  )

  return (
    <div className="bg-ct-high px-5 py-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-grotesk text-[0.625rem] uppercase tracking-[0.18em] text-ct-second/55">Energy ledger</p>
        <div className={`text-right ${hideDelta ? 'text-ct-second/35' : surplus ? 'text-ct-blood' : 'text-ct-second'}`}>
          {hideDelta ? (
            <p className="font-headline text-xl">saldo —</p>
          ) : (
            <p className="font-headline text-xl tabular-nums leading-none">
              {surplus ? '+' : ''}
              {data.delta}
              <span className="ml-1 font-grotesk text-sm font-normal text-ct-second/50">kcal</span>
            </p>
          )}
        </div>
      </div>

      {data.incompleteCapture && (
        <div className="text-xs text-ct-blood bg-ct-bloodc/40 px-3 py-2 space-y-2">
          <p>
            {data.foodIncomplete
              ? 'Eten deels gelogd — saldo voorlopig.'
              : 'Sessies zonder calorieën — sync Garmin / Health Connect.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.foodIncomplete ? (
              <Link href="/food" className="underline text-ct-blood">
                Naar Food
              </Link>
            ) : (
              <Link href="/integrations" className="underline text-ct-blood">
                Sync Garmin / Health Connect
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-6 justify-center px-2 pt-1">
        <StackCol
          label="Out"
          total={outTotal}
          segments={[
            { key: 'bmr', kcal: bmr, color: ENERGY_BMR },
            { key: 'eat', kcal: eat, color: ENERGY_EAT },
            { key: 'neat', kcal: neat, color: ENERGY_NEAT },
          ]}
        />
        <StackCol
          label="In"
          total={food}
          accentLabel
          segments={[{ key: 'food', kcal: food || 0.01, color: ENERGY_FOOD }]}
        />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ct-second/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_BMR }} />
          Rust {bmr}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_EAT }} />
          {eatUnknown ? 'Sessies —' : `Sessies ${eat}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_NEAT }} />
          {neatUnknown ? 'Overige —' : `Overige ${neat}`}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ct-blood">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_FOOD }} />
          Food {food}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowDisclaimer(s => !s)}
        className="font-grotesk text-[0.5625rem] uppercase tracking-[0.14em] text-ct-second/50 underline underline-offset-2"
      >
        {showDisclaimer ? 'Hide legend detail' : 'Legend & method'}
      </button>
      {showDisclaimer ? (
        <div className="space-y-2 text-[11px] text-ct-second/45 leading-relaxed">
          <p>Out = rust (BMR) + sessies (EAT) + overige (NEAT). In = food. Delta = In − Out.</p>
          {(steps != null || data.neatDetail) && (
            <p>
              {steps != null ? `Steps ${steps.toLocaleString()}` : 'Steps —'}
              {data.neatDetail ? ` · ${data.neatDetail}` : ''}
            </p>
          )}
          {sessionSources.length > 0 && (
            <ul className="space-y-1 bg-ct-highest/60 px-3 py-2">
              {sessionSources.slice(0, 6).map(s => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {s.label}
                    {s.detail ? <span className="text-ct-second/35"> · {s.detail}</span> : null}
                  </span>
                  <span className="tabular-nums shrink-0">{s.kcal} kcal</span>
                </li>
              ))}
            </ul>
          )}
          {data.deviceRef && (data.deviceRef.totalKcal != null || data.deviceRef.activeKcal != null) && (
            <p className="tabular-nums">
              MY PENS out {data.estimatedOut}
              {data.deviceRef.totalKcal != null ? ` · Garmin Total ${data.deviceRef.totalKcal}` : ''}
              {data.deviceRef.activeKcal != null ? ` · Active ${data.deviceRef.activeKcal}` : ''}
            </p>
          )}
          <p>{data.disclaimer}</p>
          {data.bmrLabel ? <p className="text-ct-second/30">{data.bmrLabel}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
