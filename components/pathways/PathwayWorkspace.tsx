'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  breakPathways,
  buildPathways,
  pathwayById,
  type PathwayId,
} from '@/lib/pathways/catalog'
import {
  loadFocus,
  mondayISO,
  saveFocus,
  type FocusState,
} from '@/lib/pathways/focusStorage'

type Screen = 'home' | 'log' | 'check'

type StrengthRow = {
  id: PathwayId
  score: number
  kind: 'break' | 'build'
  short: string
  dataLinked: boolean
  daysUsed: number
}

type Props = {
  onNeedNovelty?: () => void
}

export default function PathwayWorkspace({ onNeedNovelty }: Props) {
  const [screen, setScreen] = useState<Screen>('home')
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [breakId, setBreakId] = useState<PathwayId>('cue')
  const [buildId, setBuildId] = useState<PathwayId>('start')
  const [editing, setEditing] = useState(false)
  const [strengths, setStrengths] = useState<StrengthRow[]>([])
  const [daysAvailable, setDaysAvailable] = useState(0)
  const [dataLinked, setDataLinked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [logBusy, setLogBusy] = useState(false)
  const [logMsg, setLogMsg] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const f = loadFocus()
    setFocus(f)
    setBreakId(f.breakId)
    setBuildId(f.buildId)
    return fetch('/api/pathways')
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.pathways)) setStrengths(j.pathways)
        setDaysAvailable(j.daysAvailable ?? 0)
        setDataLinked(!!j.dataLinked)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const breakDef = pathwayById(focus?.breakId ?? breakId)
  const buildDef = pathwayById(focus?.buildId ?? buildId)
  const breakScore = useMemo(
    () => strengths.find((s) => s.id === (focus?.breakId ?? breakId))?.score,
    [strengths, focus, breakId],
  )
  const buildScore = useMemo(
    () => strengths.find((s) => s.id === (focus?.buildId ?? buildId))?.score,
    [strengths, focus, buildId],
  )

  function applyWeek() {
    const next: FocusState = {
      breakId,
      buildId,
      weekStart: mondayISO(),
    }
    saveFocus(next)
    setFocus(next)
    setEditing(false)
  }

  async function logMoment(
    kind: 'craving' | 'cold' | 'scaffold' | 'training' | 'slip',
  ) {
    setLogBusy(true)
    setLogMsg(null)
    try {
      if (kind === 'craving' || kind === 'cold' || kind === 'slip' || kind === 'training') {
        const action =
          kind === 'cold'
            ? 'cold_shower'
            : kind === 'training'
              ? 'training'
              : kind === 'craving'
                ? 'breath'
                : 'other'
        const outcome = kind === 'slip' ? 'slipped' : 'resisted'
        const trigger =
          kind === 'craving'
            ? `focus:${focus?.breakId ?? 'cue'}`
            : kind === 'slip'
              ? `slip:${focus?.breakId ?? 'cue'}`
              : kind === 'cold'
                ? `build:${focus?.buildId ?? 'arousal'}`
                : `build:${focus?.buildId ?? 'natural'}`
        await fetch('/api/anchor/cravings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'alcohol',
            action,
            outcome,
            trigger,
            notes: kind === 'scaffold' ? null : `pathway:${kind}`,
          }),
        })
      }
      if (kind === 'scaffold' || kind === 'cold' || kind === 'training') {
        // Append soft tag into today's Anchor notes without wiping drinks
        const todayRes = await fetch('/api/anchor/entries?date=' + new Date().toISOString().slice(0, 10))
        const existing = await todayRes.json()
        const tag =
          kind === 'scaffold'
            ? 'scaffold'
            : kind === 'cold'
              ? 'cold'
              : 'training'
        const prevNotes = typeof existing?.notes === 'string' ? existing.notes : ''
        const notes = prevNotes.includes(tag) ? prevNotes : `${prevNotes} ${tag}`.trim()
        let supplements: string[] = []
        try {
          supplements = JSON.parse(existing?.supplements ?? '[]')
        } catch {
          supplements = []
        }
        if (!supplements.includes(tag)) supplements.push(tag)
        await fetch('/api/anchor/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: existing?.date ?? new Date().toISOString().slice(0, 10),
            alcoholDrinks: existing?.alcoholDrinks ?? 0,
            cocaineUsed: existing?.cocaineUsed ?? false,
            escortUsed: existing?.escortUsed ?? false,
            mood: existing?.mood ?? null,
            energy: existing?.energy ?? null,
            sleepHours: existing?.sleepHours ?? null,
            supplements,
            notes,
          }),
        })
      }
      setLogMsg('Logged. Strength updates after ~7 days of history.')
      await refresh()
      setScreen('home')
    } catch {
      setLogMsg('Could not save — try Anchor directly.')
    } finally {
      setLogBusy(false)
    }
  }

  if (!focus) return null

  const tabs: { id: Screen; label: string }[] = [
    { id: 'home', label: 'Focus' },
    { id: 'log', label: 'Log' },
    { id: 'check', label: 'Weekly' },
  ]

  return (
    <div className="mb-8">
      <div className="flex gap-1 p-1 rounded-xl bg-pens-navy/60 border border-pens-muted/20 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setScreen(t.id)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
              screen === t.id
                ? 'bg-cyan-600/90 text-pens-deep'
                : 'text-pens-cream/45 hover:text-pens-cream/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {screen === 'home' && (
        <StackHome
          focus={focus}
          breakDef={breakDef}
          buildDef={buildDef}
          breakScore={breakScore}
          buildScore={buildScore}
          dataLinked={dataLinked}
          daysAvailable={daysAvailable}
          loading={loading}
          editing={editing}
          breakId={breakId}
          buildId={buildId}
          setBreakId={setBreakId}
          setBuildId={setBuildId}
          setEditing={setEditing}
          applyWeek={applyWeek}
          onLog={() => setScreen('log')}
          onCheck={() => setScreen('check')}
          onNeedNovelty={onNeedNovelty}
        />
      )}

      {screen === 'log' && (
        <StackLog
          breakShort={breakDef?.short}
          buildShort={buildDef?.short}
          busy={logBusy}
          msg={logMsg}
          onLog={logMoment}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'check' && (
        <StackCheck
          focus={focus}
          breakDef={breakDef}
          buildDef={buildDef}
          breakScore={breakScore}
          buildScore={buildScore}
          dataLinked={dataLinked}
          onKeep={() => {
            applyWeek()
            setScreen('home')
          }}
          onEdit={() => {
            setEditing(true)
            setScreen('home')
          }}
        />
      )}
    </div>
  )
}

function StackHome(props: {
  focus: FocusState
  breakDef: ReturnType<typeof pathwayById>
  buildDef: ReturnType<typeof pathwayById>
  breakScore?: number
  buildScore?: number
  dataLinked: boolean
  daysAvailable: number
  loading: boolean
  editing: boolean
  breakId: PathwayId
  buildId: PathwayId
  setBreakId: (id: PathwayId) => void
  setBuildId: (id: PathwayId) => void
  setEditing: (v: boolean) => void
  applyWeek: () => void
  onLog: () => void
  onCheck: () => void
  onNeedNovelty?: () => void
}) {
  const {
    focus,
    breakDef,
    buildDef,
    breakScore,
    buildScore,
    dataLinked,
    daysAvailable,
    loading,
    editing,
    breakId,
    buildId,
    setBreakId,
    setBuildId,
    setEditing,
    applyWeek,
    onLog,
    onCheck,
    onNeedNovelty,
  } = props

  return (
    <section>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80 font-semibold">
            This week
          </p>
          <h1 className="text-2xl font-bold text-pens-cream mt-1 font-[family-name:var(--font-newsreader)]">
            One break · one build
          </h1>
          <p className="text-xs text-pens-cream/45 mt-1">Week of {focus.weekStart}</p>
        </div>
        {dataLinked ? (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {daysAvailable}d linked
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-200/80 border border-amber-500/25">
            {daysAvailable}/7
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 mb-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-pens-cream/40">Break</span>
            <select
              value={breakId}
              onChange={(e) => setBreakId(e.target.value as PathwayId)}
              className="mt-1 w-full rounded-xl bg-pens-navy border border-pens-muted/30 px-3 py-2.5 text-sm"
            >
              {breakPathways().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-pens-cream/40">Build</span>
            <select
              value={buildId}
              onChange={(e) => setBuildId(e.target.value as PathwayId)}
              className="mt-1 w-full rounded-xl bg-pens-navy border border-pens-muted/30 px-3 py-2.5 text-sm"
            >
              {buildPathways().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={applyWeek}
            className="w-full rounded-xl bg-cyan-600/90 text-pens-deep text-sm font-semibold py-3"
          >
            Save week focus
          </button>
        </div>
      ) : (
        <div className="grid gap-3 mb-4">
          <div className="rounded-2xl border border-pens-crimson/35 bg-pens-crimson/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-pens-crimson/80">Weaken</p>
            <p className="text-lg font-semibold text-pens-cream mt-1">{breakDef?.short}</p>
            <p className="text-sm text-pens-cream/55 mt-2 leading-snug">{breakDef?.move}</p>
            {!loading && breakScore != null && (
              <p className="text-xs text-pens-cream/35 mt-3 tabular-nums">Strength ~{breakScore}</p>
            )}
          </div>
          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">Thicken</p>
            <p className="text-lg font-semibold text-pens-cream mt-1">{buildDef?.short}</p>
            <p className="text-sm text-pens-cream/55 mt-2 leading-snug">{buildDef?.move}</p>
            {!loading && buildScore != null && (
              <p className="text-xs text-pens-cream/35 mt-3 tabular-nums">Strength ~{buildScore}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onLog}
          className="w-full rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-pens-deep text-sm font-semibold py-3.5"
        >
          Log a moment
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 rounded-xl border border-pens-muted/30 text-sm text-pens-cream/60 py-3"
          >
            Change focus
          </button>
          <button
            type="button"
            onClick={onCheck}
            className="flex-1 rounded-xl border border-pens-muted/30 text-sm text-pens-cream/60 py-3"
          >
            Weekly check
          </button>
        </div>
        {onNeedNovelty && (
          <button
            type="button"
            onClick={onNeedNovelty}
            className="w-full text-xs text-pens-cream/35 hover:text-pens-cream/55 py-2"
          >
            Need a novelty route instead ↓
          </button>
        )}
      </div>

      <p className="text-[11px] text-pens-cream/30 mt-4 leading-relaxed">
        Drinks &amp; sleep still live in{' '}
        <Link href="/anchor" className="text-cyan-400/60 underline-offset-2 hover:underline">
          Anchor
        </Link>{' '}
        / Sleep. Habit proxies — not a brain scan.
      </p>
    </section>
  )
}

function StackLog(props: {
  breakShort?: string
  buildShort?: string
  busy: boolean
  msg: string | null
  onLog: (k: 'craving' | 'cold' | 'scaffold' | 'training' | 'slip') => void
  onBack: () => void
}) {
  const { breakShort, buildShort, busy, msg, onLog, onBack } = props
  const actions: {
    id: 'craving' | 'cold' | 'scaffold' | 'training' | 'slip'
    label: string
    hint: string
  }[] = [
    { id: 'craving', label: 'Craving now', hint: `Tied to break: ${breakShort ?? '—'}` },
    { id: 'cold', label: 'Cold done', hint: 'Builds arousal / interrupt' },
    { id: 'scaffold', label: 'Scaffold used', hint: `Build: ${buildShort ?? 'start'}` },
    { id: 'training', label: 'Training / reward rep', hint: 'Natural reward practice' },
    { id: 'slip', label: 'Slipped', hint: 'Honest mark — no shame log' },
  ]

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-pens-cream/45 hover:text-pens-cream mb-4"
      >
        ← Focus
      </button>
      <h2 className="text-xl font-bold text-pens-cream font-[family-name:var(--font-newsreader)] mb-1">
        Log a moment
      </h2>
      <p className="text-sm text-pens-cream/50 mb-5">Under 15 seconds. Big taps only.</p>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => onLog(a.id)}
            className="w-full text-left rounded-xl border border-pens-muted/25 bg-pens-navy/40 px-4 py-4 disabled:opacity-50 active:scale-[0.99]"
          >
            <div className="text-sm font-semibold text-pens-cream">{a.label}</div>
            <div className="text-xs text-pens-cream/40 mt-0.5">{a.hint}</div>
          </button>
        ))}
      </div>
      <Link
        href="/anchor"
        className="block mt-4 text-center text-xs text-cyan-400/70 py-2"
      >
        Need drinks / full day check-in → Anchor
      </Link>
      {msg && <p className="text-xs text-pens-cream/45 mt-2 text-center">{msg}</p>}
    </section>
  )
}

function StackCheck(props: {
  focus: FocusState
  breakDef: ReturnType<typeof pathwayById>
  buildDef: ReturnType<typeof pathwayById>
  breakScore?: number
  buildScore?: number
  dataLinked: boolean
  onKeep: () => void
  onEdit: () => void
}) {
  const { focus, breakDef, buildDef, breakScore, buildScore, dataLinked, onKeep, onEdit } = props

  let line = 'Keep logging — Check gets sharper after ~7 linked days.'
  if (dataLinked && breakScore != null && buildScore != null) {
    if (breakScore > 70) line = 'Break loop still loud. Next week: same break focus, more interrupts.'
    else if (buildScore < 35) line = 'Build loop still thin. Protect sleep / scaffold reps.'
    else line = 'Holding. Same pair another week, or swap one side only.'
  }

  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80 font-semibold mb-2">
        Weekly check · {focus.weekStart}
      </p>
      <h2 className="text-xl font-bold text-pens-cream font-[family-name:var(--font-newsreader)] mb-4">
        Honest read
      </h2>
      <p className="text-sm text-pens-cream/70 leading-relaxed border-l-2 border-cyan-500/40 pl-3 mb-5">
        {line}
      </p>
      <div className="grid gap-3 mb-5">
        <div className="rounded-xl border border-pens-crimson/30 p-3 flex justify-between">
          <span className="text-sm text-pens-cream/80">{breakDef?.short}</span>
          <span className="text-sm tabular-nums text-pens-cream/50">
            {breakScore != null ? `~${breakScore}` : '—'}
          </span>
        </div>
        <div className="rounded-xl border border-emerald-500/30 p-3 flex justify-between">
          <span className="text-sm text-pens-cream/80">{buildDef?.short}</span>
          <span className="text-sm tabular-nums text-pens-cream/50">
            {buildScore != null ? `~${buildScore}` : '—'}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onKeep}
        className="w-full rounded-xl bg-cyan-600/90 text-pens-deep text-sm font-semibold py-3.5 mb-2"
      >
        Keep same focus next week
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-xl border border-pens-muted/30 text-sm text-pens-cream/60 py-3"
      >
        Change one side
      </button>
    </section>
  )
}
