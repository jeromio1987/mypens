/** Deterministic “fueling Read” for mobile — explain first, never diet advice. */

export type FuelingRead = {
  verdict: string
  cause: string
  oneMove: string
  coverage: 'none' | 'thin' | 'ok' | 'pending' | 'error'
}

function dayWord(date?: string): { todayLike: boolean; dayRef: string; possessive: string } {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { todayLike: true, dayRef: 'today', possessive: "today's" }
  }
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const y = new Date(today + 'T12:00:00')
  y.setDate(y.getDate() - 1)
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
  if (date === today) return { todayLike: true, dayRef: 'today', possessive: "today's" }
  if (date === yesterday) return { todayLike: false, dayRef: 'yesterday', possessive: "yesterday's" }
  const d = new Date(date + 'T12:00:00')
  const short = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return { todayLike: false, dayRef: short, possessive: `${short}'s` }
}

/** Eyebrow for the fueling Read card — follows the selected calendar day. */
export function fuelingReadEyebrow(date: string): string {
  const { dayRef, todayLike } = dayWord(date)
  if (todayLike) return "Today's Read"
  if (dayRef === 'yesterday') return "Yesterday's Read"
  return `Read for ${dayRef}`
}

export function fuelingRead(input: {
  kcal: number
  proteinG: number
  /** Pass -1 while food list is loading / failed so we never fake “no meals”. */
  entryCount: number
  targets: { kcal: number; proteinG: number }
  hour?: number
  /** Selected yyyy-mm-dd — keeps copy honest when viewing Yesterday / history. */
  date?: string
}): FuelingRead {
  const hour = input.hour ?? new Date().getHours()
  const { kcal, proteinG, entryCount, targets } = input
  const { dayRef, possessive, todayLike } = dayWord(input.date)

  if (entryCount < 0) {
    return {
      verdict: 'Loading fueling…',
      cause: 'Waiting for MY PENS food list — not treating missing data as an empty day.',
      oneMove: 'If this hangs, open /api/health on the phone browser and restart Next on the PC.',
      coverage: 'pending',
    }
  }

  if (entryCount === 0) {
    return {
      verdict: `Fueling unknown ${todayLike ? 'today' : `for ${dayRef}`}`,
      cause: `No meals captured ${todayLike ? 'yet' : 'that day'} — the planner treats food as missing, not as a deficit.`,
      oneMove: todayLike
        ? hour < 14
          ? 'Capture breakfast or lunch with one photo.'
          : 'Capture what you ate — photo of the pack or plate.'
        : 'Switch to Today to log, or copy a meal into this date.',
      coverage: 'none',
    }
  }

  const proteinPct = targets.proteinG > 0 ? proteinG / targets.proteinG : 1
  const kcalPct = targets.kcal > 0 ? kcal / targets.kcal : 1

  if (entryCount <= 1 && (todayLike ? hour >= 16 : true)) {
    return {
      verdict: 'Thin fueling signal',
      cause: `Only one entry ${todayLike ? 'late in the day' : `on ${dayRef}`} — easy to misread as low energy availability.`,
      oneMove: todayLike
        ? 'Photo the rest of today’s food (or type the brand). Skip macro theater.'
        : 'If the day was incomplete, mark it incomplete or add the missing meals.',
      coverage: 'thin',
    }
  }

  if (proteinPct < 0.55 && (todayLike ? hour >= 15 : true)) {
    return {
      verdict: 'Protein looks soft so far',
      cause: `${Math.round(proteinG)}g vs a ${targets.proteinG}g day cue — soft constraint for gym / body-comp weeks only.`,
      oneMove: todayLike
        ? 'If you train hard tonight, prefer a protein-forward meal — or keep the session easy.'
        : 'Context only for that day — not a diet lecture.',
      coverage: entryCount < 3 ? 'thin' : 'ok',
    }
  }

  if (kcalPct < 0.45 && (todayLike ? hour >= 17 : true)) {
    return {
      verdict: 'Day looks light on energy',
      cause: `${Math.round(kcal)} kcal logged — may be under-capture, not a diet.`,
      oneMove: todayLike
        ? 'Capture remaining meals with a photo before judging the week plan.'
        : 'Check whether food capture was incomplete before reading the deficit.',
      coverage: entryCount < 3 ? 'thin' : 'ok',
    }
  }

  if (kcalPct > 1.25) {
    return {
      verdict: 'Fueling above the day cue',
      cause: `${Math.round(kcal)} kcal logged vs ${targets.kcal} cue — context for weight noise, not a lecture.`,
      oneMove: 'Keep training as planned unless sleep / RHR says otherwise.',
      coverage: 'ok',
    }
  }

  return {
    verdict: 'Fueling in a usable band',
    cause: `${Math.round(kcal)} kcal · ${Math.round(proteinG)}g protein across ${entryCount} item${entryCount === 1 ? '' : 's'} (${possessive} log).`,
    oneMove: 'No food action required — open Training for this week’s plan if you want the next move.',
    coverage: 'ok',
  }
}
