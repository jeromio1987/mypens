import type { PathwayId } from './catalog'
import { PATHWAYS } from './catalog'

export type DaySignals = {
  date: string
  alcoholDrinks: number
  cocaineUsed: boolean
  mood: number | null
  energy: number | null
  sleepHours: number | null
  cravingCount: number
  cravingResisted: number
  cravingSlipped: number
  coldHint: boolean
  scaffoldHint: boolean
  trainingHint: boolean
}

export type PathwayStrength = {
  id: PathwayId
  score: number
  kind: 'break' | 'build'
  short: string
  dataLinked: boolean
  daysUsed: number
}

function clamp(n: number, lo = 5, hi = 95) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function rate(days: DaySignals[], pred: (d: DaySignals) => boolean) {
  if (!days.length) return 0
  return days.filter(pred).length / days.length
}

function avg(
  days: DaySignals[],
  pick: (d: DaySignals) => number | null,
): number | null {
  let s = 0
  let c = 0
  for (const d of days) {
    const v = pick(d)
    if (v != null && !Number.isNaN(v)) {
      s += v
      c++
    }
  }
  return c ? s / c : null
}

/** Score one pathway from recent day signals. Returns null if too little data. */
export function scorePathway(
  id: PathwayId,
  days: DaySignals[],
): { score: number; n: number } | null {
  if (days.length < 7) return null
  const recent = days.slice(-28)
  const n = recent.length
  let v: number

  switch (id) {
    case 'cue': {
      const slips = rate(recent, (d) => d.cravingSlipped > 0 || d.cocaineUsed)
      const craves = rate(recent, (d) => d.cravingCount > 0)
      v = 30 + slips * 40 + craves * 25
      break
    }
    case 'relief': {
      v =
        28 +
        rate(recent, (d) => d.alcoholDrinks >= 2 && (d.mood == null || d.mood <= 2)) * 45 +
        rate(recent, (d) => d.cravingCount > 0) * 20
      break
    }
    case 'alcSleep': {
      v =
        25 +
        rate(
          recent,
          (d) => d.alcoholDrinks >= 2 && (d.sleepHours == null || d.sleepHours < 6.5),
        ) *
          50 +
        rate(recent, (d) => d.alcoholDrinks >= 3) * 20
      break
    }
    case 'start': {
      v = 22 + rate(recent, (d) => d.scaffoldHint) * 50 + rate(recent, (d) => d.energy != null && d.energy >= 3) * 15
      break
    }
    case 'sleepHead': {
      const sh = avg(recent, (d) => d.sleepHours)
      v = sh == null ? 32 : Math.max(12, Math.min(90, (sh - 4.5) * 18))
      break
    }
    case 'natural': {
      v =
        18 +
        rate(recent, (d) => d.trainingHint) * 45 +
        rate(recent, (d) => d.alcoholDrinks === 0 && !d.cocaineUsed) * 20
      break
    }
    case 'arousal': {
      v = 20 + rate(recent, (d) => d.coldHint) * 55
      break
    }
    default:
      v = 50
  }

  return { score: clamp(v), n }
}

export function scoreAllPathways(days: DaySignals[]): PathwayStrength[] {
  return PATHWAYS.map((p) => {
    const scored = scorePathway(p.id, days)
    return {
      id: p.id,
      kind: p.kind,
      short: p.short,
      score: scored?.score ?? (p.kind === 'break' ? 70 : 30),
      dataLinked: !!scored,
      daysUsed: scored?.n ?? days.length,
    }
  })
}

/** Parse free-text notes / supplements for soft tags (cold, scaffold, training). */
export function inferHints(notes: string | null | undefined, supplementsJson: string): {
  coldHint: boolean
  scaffoldHint: boolean
  trainingHint: boolean
} {
  const text = `${notes ?? ''} ${supplementsJson}`.toLowerCase()
  return {
    coldHint: /cold|plunge|ijs|douche/.test(text),
    scaffoldHint: /scaffold|first task|body doubl|checklist|2.?min/.test(text),
    trainingHint: /train|gym|ride|run|hiit|workout/.test(text),
  }
}
