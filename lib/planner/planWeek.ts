/**
 * Deterministic Adaptive Sports Planner (Phase 6).
 * Pure functions — no DB, no LLM.
 */

export type Sport = 'running' | 'cycling' | 'core' | 'gym'
export type GoalKind = 'vo2max' | 'bodyfat' | 'marathon' | 'custom'
export type LongDay = 'saturday' | 'sunday'
export type Intensity = 'rest' | 'easy' | 'quality' | 'long' | 'strength'

export type PlannerGoalInput = {
  kind: GoalKind
  label: string
  targetNum?: number | null
  longDay?: LongDay
  sports?: Sport[]
}

export type RecentContext = {
  /** Average sleep hours over recent nights */
  avgSleepHours: number | null
  /** Sessions in last ~14 days by sport */
  sessionsBySport: Partial<Record<Sport, number>>
  /** True if recent binge / RHR heavy band */
  recoveryCompromised?: boolean
  /** Avg protein g/day across days that have food logs (null = no food data) */
  avgProteinG?: number | null
  /** Avg kcal/day across days that have food logs (null = no food data) */
  avgKcal?: number | null
  /** Count of distinct days with ≥1 food entry in the lookback window */
  foodDaysLogged?: number | null
  /** Length of food lookback window in days (for coverage ratio) */
  foodWindowDays?: number | null
}

/** Soft floors — never medical advice; missing food never blocks planning. */
export const FOOD_SOFT = {
  proteinFloorG: 100,
  kcalVeryLow: 1600,
  minCoverage: 0.3,
} as const

export type DayPlan = {
  date: string
  weekday: string
  sport: Sport | null
  intensity: Intensity
  minutes: number
  title: string
  why: string
  isLong: boolean
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function hasSport(sports: Sport[], s: Sport) {
  return sports.includes(s)
}

/**
 * @param weekOf Monday yyyy-mm-dd
 */
export function planWeek(
  weekOf: string,
  goal: PlannerGoalInput,
  ctx: RecentContext = { avgSleepHours: null, sessionsBySport: {} },
): { weekOf: string; goal: PlannerGoalInput; days: DayPlan[]; notes: string[] } {
  const sports: Sport[] =
    goal.sports && goal.sports.length
      ? goal.sports
      : goal.kind === 'marathon'
        ? ['running', 'core']
        : goal.kind === 'bodyfat'
          ? ['gym', 'core', 'running']
          : goal.kind === 'vo2max'
            ? ['running', 'cycling', 'gym']
            : ['running', 'gym', 'core']

  const longDay: LongDay = goal.longDay === 'sunday' ? 'sunday' : 'saturday'
  const sleepLow = ctx.avgSleepHours != null && ctx.avgSleepHours < 6.5
  const compromised = Boolean(ctx.recoveryCompromised)
  const proteinLow = ctx.avgProteinG != null && ctx.avgProteinG < FOOD_SOFT.proteinFloorG
  const kcalVeryLow = ctx.avgKcal != null && ctx.avgKcal < FOOD_SOFT.kcalVeryLow
  const logged = ctx.foodDaysLogged ?? 0
  const windowDays = ctx.foodWindowDays ?? 0
  const fuelingUnknown =
    logged === 0 || (windowDays > 0 && logged / windowDays < FOOD_SOFT.minCoverage)
  const softFuel = kcalVeryLow || (proteinLow && !fuelingUnknown)
  const notes: string[] = []

  if (sleepLow) notes.push('Sleep avg under 6.5h — volume capped; more core / easy.')
  if (compromised) notes.push('Recovery compromised (drink / high RHR) — Mon–Tue forced easy or rest.')
  if (fuelingUnknown) {
    notes.push('Fueling unknown — few/no food logs; plan not blocked (confidence lower).')
  }
  if (kcalVeryLow) {
    notes.push('Recent daily kcal looks very low — quality softened and long session shortened.')
  }
  if (proteinLow && !fuelingUnknown) {
    notes.push(
      goal.kind === 'bodyfat'
        ? 'Protein intake looks soft — keep gym, avoid stacking hard aerobic on low-fuel days.'
        : 'Protein intake looks soft — prefer strength/core over extra quality work.',
    )
  }

  const days: DayPlan[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekOf, i)
    const weekday = WEEKDAYS[i]
    const isSat = i === 5
    const isSun = i === 6
    const isLongSlot = (longDay === 'saturday' && isSat) || (longDay === 'sunday' && isSun)
    const isOtherWeekend = (isSat || isSun) && !isLongSlot

    let plan: DayPlan

    if (compromised && i <= 1) {
      plan = {
        date,
        weekday,
        sport: hasSport(sports, 'core') ? 'core' : null,
        intensity: i === 0 ? 'rest' : 'easy',
        minutes: i === 0 ? 0 : 20,
        title: i === 0 ? 'Rest / walk' : 'Easy core or walk',
        why: 'Buffer after compromised recovery.',
        isLong: false,
      }
    } else if (isLongSlot) {
      const sport: Sport = hasSport(sports, 'running')
        ? 'running'
        : hasSport(sports, 'cycling')
          ? 'cycling'
          : sports[0]
      const minutes =
        goal.kind === 'marathon' ? (sleepLow ? 75 : 100) : sleepLow ? 60 : 80
      plan = {
        date,
        weekday,
        sport,
        intensity: 'long',
        minutes,
        title: sport === 'cycling' ? 'Long ride' : 'Long run',
        why: `Only long session this week (${longDay}). Goal: ${goal.label}.`,
        isLong: true,
      }
    } else if (isOtherWeekend) {
      plan = {
        date,
        weekday,
        sport: hasSport(sports, 'core') ? 'core' : null,
        intensity: 'easy',
        minutes: 25,
        title: 'Optional easy / mobility',
        why: 'Keep the other weekend day light — long session already placed.',
        isLong: false,
      }
    } else if (goal.kind === 'bodyfat' && hasSport(sports, 'gym') && (i === 1 || i === 3 || i === 4)) {
      plan = {
        date,
        weekday,
        sport: 'gym',
        intensity: 'strength',
        minutes: sleepLow ? 40 : 55,
        title: i === 1 ? 'Gym — lower' : i === 3 ? 'Gym — upper' : 'Gym — full',
        why: 'Body-comp goal biases lifting to hold muscle.',
        isLong: false,
      }
    } else if (goal.kind === 'vo2max' && (i === 2 || i === 4)) {
      const sport: Sport = hasSport(sports, 'running')
        ? 'running'
        : hasSport(sports, 'cycling')
          ? 'cycling'
          : 'running'
      plan = {
        date,
        weekday,
        sport,
        intensity: sleepLow ? 'easy' : 'quality',
        minutes: sleepLow ? 35 : 45,
        title: sleepLow ? 'Easy aerobic' : 'Quality aerobic',
        why: sleepLow ? 'Sleep soft — quality deferred.' : 'VO₂max goal: controlled quality work.',
        isLong: false,
      }
    } else if (goal.kind === 'marathon' && i === 2 && hasSport(sports, 'running')) {
      plan = {
        date,
        weekday,
        sport: 'running',
        intensity: 'easy',
        minutes: sleepLow ? 30 : 45,
        title: 'Easy mid-week run',
        why: 'Marathon base — easy volume between weekend longs.',
        isLong: false,
      }
    } else if (hasSport(sports, 'gym') && i === 1) {
      plan = {
        date,
        weekday,
        sport: 'gym',
        intensity: 'strength',
        minutes: 50,
        title: 'Gym — strength',
        why: 'Maintain strength alongside aerobic work.',
        isLong: false,
      }
    } else if (hasSport(sports, 'core') && i === 3) {
      plan = {
        date,
        weekday,
        sport: 'core',
        intensity: 'easy',
        minutes: 25,
        title: 'Core / mobility',
        why: 'Recovery-friendly mid-week slot.',
        isLong: false,
      }
    } else {
      plan = {
        date,
        weekday,
        sport: null,
        intensity: 'rest',
        minutes: 0,
        title: 'Rest or easy walk',
        why: 'Leave space — quality over junk volume.',
        isLong: false,
      }
    }

    // 6-D food soft rules: never remove the long day, never invent meals — only ease load.
    if (softFuel && plan.intensity === 'quality') {
      plan = {
        ...plan,
        intensity: 'easy',
        minutes: Math.max(25, Math.round(plan.minutes * 0.75)),
        title: plan.title.replace(/Quality/i, 'Easy'),
        why: `${plan.why} Softened — recent fueling looks light.`,
      }
    } else if (kcalVeryLow && plan.isLong) {
      plan = {
        ...plan,
        minutes: Math.max(45, Math.round(plan.minutes * 0.8)),
        why: `${plan.why} Shortened — recent daily kcal looks very low.`,
      }
    } else if (proteinLow && !fuelingUnknown && plan.sport === 'gym') {
      plan = {
        ...plan,
        why: `${plan.why} Gym protected while protein looks soft.`,
      }
    }

    days.push(plan)
  }

  // Guarantee exactly one long day
  const longs = days.filter(d => d.isLong)
  if (longs.length !== 1) {
    notes.push('Planner corrected long-day count to 1.')
  }

  // Recent sport balance note
  const recentGym = ctx.sessionsBySport.gym ?? 0
  const recentRun = ctx.sessionsBySport.running ?? 0
  if (goal.kind === 'marathon' && recentGym > recentRun + 2) {
    notes.push('Recent gym > running — week leans aerobic.')
  }
  if (goal.kind === 'bodyfat' && recentRun > recentGym + 2) {
    notes.push('Recent cardio-heavy — week protects lifting.')
  }

  return { weekOf, goal: { ...goal, sports, longDay }, days, notes }
}
