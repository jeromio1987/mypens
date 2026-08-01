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
  foodCoverage?: boolean
  foodIncomplete?: boolean
  neatSource?: string
  sources: Source[]
  neatDetail?: string
  deviceRef: DeviceRef | null
  disclaimer: string
  foodCoverage7d?: {
    loggedDays: number
    windowDays: number
    thin: boolean
    message: string | null
  }
}

type WeekDay = {
  date?: string
  eatKcal?: number
  foodKcal?: number
  imputed?: boolean
}

export default function EnergyBalanceCard({ date, refresh = 0 }: { date: string; refresh?: number }) {
  const [data, setData] = useState<Balance | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [avgSessionDayEat, setAvgSessionDayEat] = useState<number | null>(null)
  const [avgFoodKcal, setAvgFoodKcal] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setErr(null)
    Promise.all([
      fetch(`/api/energy-balance?date=${encodeURIComponent(date)}`),
      fetch(`/api/energy-balance?week=1&date=${encodeURIComponent(date)}`),
    ])
      .then(async ([dayRes, weekRes]) => {
        const j = await dayRes.json()
        if (!dayRes.ok) throw new Error(j.error || 'failed')
        if (!cancelled) setData(j)

        if (weekRes.ok) {
          const w = await weekRes.json()
          const days = Array.isArray(w.days) ? (w.days as WeekDay[]) : []
          const eatDays = days
            .filter(
              d =>
                !d.imputed &&
                d.date !== date &&
                typeof d.eatKcal === 'number' &&
                d.eatKcal > 0,
            )
            .map(d => d.eatKcal as number)
          const foodDays = days
            .filter(
              d =>
                !d.imputed &&
                d.date !== date &&
                typeof d.foodKcal === 'number' &&
                d.foodKcal > 0,
            )
            .map(d => d.foodKcal as number)
          const mean = (xs: number[]) =>
            xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
          if (!cancelled) {
            setAvgSessionDayEat(mean(eatDays))
            setAvgFoodKcal(mean(foodDays))
          }
        } else if (!cancelled) {
          setAvgSessionDayEat(null)
          setAvgFoodKcal(null)
        }
      })
      .catch(e => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'failed')
      })
    return () => {
      cancelled = true
    }
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
  const sessionSources = data.sources.filter(
    s =>
      s.origin === 'garmin_activity' ||
      s.origin === 'training' ||
      s.origin === 'notes' ||
      s.origin === 'pushed',
  )
  const steps = data.deviceRef?.steps
  const neatUnknown = data.neatSource === 'none'
  const neatFromSteps = data.neatSource === 'steps_model'
  // Prefer explicit foodCoverage; fall back to foodKcal>0 for older payloads.
  const hasFood = data.foodCoverage != null ? data.foodCoverage : data.foodKcal > 0
  const eatUnknown =
    data.incompleteCapture && !data.foodIncomplete && hasFood && data.eatKcal === 0
  const hideDelta = data.incompleteCapture || !hasFood

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
  const sessionCount = sessionSources.length

  const sessionChip = eatUnknown
    ? 'Sessions — kcal not synced'
    : sessionCount > 0
      ? `Sessions ${eat} kcal · ${sessionCount} logged`
      : `Sessions ${eat} kcal`

  let sessionVsUsual: string | null = null
  if (!eatUnknown && eat > 0 && avgSessionDayEat != null && avgSessionDayEat > 0) {
    const pct = (eat - avgSessionDayEat) / avgSessionDayEat
    const usual = `~${avgSessionDayEat} kcal · 7d session days`
    if (Math.abs(pct) < 0.12) sessionVsUsual = `Near your usual session (${usual})`
    else if (pct > 0) sessionVsUsual = `Above your usual session (${usual})`
    else sessionVsUsual = `Below your usual session (${usual})`
  }

  const feedbackChips: string[] = []
  if (!hasFood) feedbackChips.push('No food logged')
  else if (data.foodIncomplete) feedbackChips.push('Food capture incomplete')
  else if (data.incompleteCapture) feedbackChips.push('Session kcal missing')
  if (data.foodCoverage7d?.thin) {
    feedbackChips.push(`Coverage ${data.foodCoverage7d.loggedDays}/${data.foodCoverage7d.windowDays}`)
  }
  if (avgFoodKcal != null && avgFoodKcal > 0 && food > 0 && !data.foodIncomplete) {
    const pct = (food - avgFoodKcal) / avgFoodKcal
    if (Math.abs(pct) >= 0.12) {
      feedbackChips.push(
        pct > 0 ? `Food above 7d avg (~${avgFoodKcal})` : `Food below 7d avg (~${avgFoodKcal})`,
      )
    }
  }

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
            <p className="font-headline text-xl">—</p>
          ) : (
            <p className="font-headline text-xl tabular-nums leading-none">
              {surplus ? '+' : ''}
              {data.delta}
              <span className="ml-1 font-grotesk text-sm font-normal text-ct-second/50">kcal</span>
            </p>
          )}
        </div>
      </div>

      {data.foodCoverage7d?.thin && data.foodCoverage7d.message && (
        <div className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/25 px-3 py-2">
          {data.foodCoverage7d.message}{' '}
          <Link href="/food" className="underline text-amber-100">
            Log food →
          </Link>
        </div>
      )}

      {hideDelta && (
        <div className="text-xs text-ct-second/70 bg-ct-lowest px-3 py-2 space-y-2">
          <p>
            {!hasFood
              ? 'No meals logged for this day yet. A deficit here would be a capture gap, not a result.'
              : data.foodIncomplete
                ? 'Food partly logged — balance is provisional.'
                : 'Training sessions missing kcal — sync Garmin / Health Connect.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!hasFood || data.foodIncomplete ? (
              <Link href="/food" className="underline text-ct-blood">
                Finish logging food
              </Link>
            ) : (
              <Link href="/integrations" className="underline text-ct-blood">
                Sync Garmin / Health Connect
              </Link>
            )}
          </div>
        </div>
      )}
      {!hideDelta ? (
        <p className="text-xs text-ct-second/55">
          Food minus estimated burn. Device estimates, not measured.
        </p>
      ) : null}

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
          Resting ~{bmr} kcal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_EAT }} />
          {sessionChip}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_NEAT }} />
          {neatUnknown
            ? 'Other movement — no step data'
            : neatFromSteps
              ? `Other movement ${neat} kcal · steps estimate`
              : `Other movement ${neat} kcal`}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ct-blood">
          <span className="w-2 h-2" style={{ backgroundColor: ENERGY_FOOD }} />
          Food {food} kcal
        </span>
      </div>

      {sessionVsUsual ? <p className="text-[11px] text-orange-300/90">{sessionVsUsual}</p> : null}

      {neatFromSteps ? (
        <p className="text-[11px] text-teal-300/80">
          NEAT from steps model
          {steps != null ? ` · ${steps.toLocaleString()} steps` : ''}
          {data.neatDetail ? ` · session burn subtracted` : ''}
        </p>
      ) : null}

      {feedbackChips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {feedbackChips.map(chip => (
            <span
              key={chip}
              className="text-[10px] px-2 py-1 border border-ct-blood/25 text-ct-second/60 bg-ct-bloodc/20"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDisclaimer(s => !s)}
        className="font-grotesk text-[0.5625rem] uppercase tracking-[0.14em] text-ct-second/50 underline underline-offset-2"
      >
        {showDisclaimer ? 'Hide legend detail' : 'Legend & method'}
      </button>
      {showDisclaimer ? (
        <div className="space-y-2 text-[11px] text-ct-second/45 leading-relaxed">
          <p>
            Out = resting (BMR) + training sessions (EAT) + other movement (NEAT). In = food. Delta = In −
            Out.
          </p>
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
