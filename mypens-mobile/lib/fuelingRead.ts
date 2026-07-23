/** Deterministic “fueling Read” for mobile — explain first, never diet advice. */

export type FuelingRead = {
  verdict: string
  cause: string
  oneMove: string
  coverage: 'none' | 'thin' | 'ok'
}

export function fuelingRead(input: {
  kcal: number
  proteinG: number
  entryCount: number
  targets: { kcal: number; proteinG: number }
  hour?: number
}): FuelingRead {
  const hour = input.hour ?? new Date().getHours()
  const { kcal, proteinG, entryCount, targets } = input

  if (entryCount === 0) {
    return {
      verdict: 'Fueling unknown today',
      cause: 'No meals captured yet — the planner treats food as missing, not as a deficit.',
      oneMove: hour < 14 ? 'Capture breakfast or lunch with one photo.' : 'Capture what you ate — photo of the pack or plate.',
      coverage: 'none',
    }
  }

  const proteinPct = targets.proteinG > 0 ? proteinG / targets.proteinG : 1
  const kcalPct = targets.kcal > 0 ? kcal / targets.kcal : 1

  if (entryCount <= 1 && hour >= 16) {
    return {
      verdict: 'Thin fueling signal',
      cause: 'Only one entry late in the day — easy to misread as low energy availability.',
      oneMove: 'Photo the rest of today’s food (or type the brand). Skip macro theater.',
      coverage: 'thin',
    }
  }

  if (proteinPct < 0.55 && hour >= 15) {
    return {
      verdict: 'Protein looks soft so far',
      cause: `${Math.round(proteinG)}g vs a ${targets.proteinG}g day cue — soft constraint for gym / body-comp weeks only.`,
      oneMove: 'If you train hard tonight, prefer a protein-forward meal — or keep the session easy.',
      coverage: entryCount < 3 ? 'thin' : 'ok',
    }
  }

  if (kcalPct < 0.45 && hour >= 17) {
    return {
      verdict: 'Day looks light on energy',
      cause: `${Math.round(kcal)} kcal logged — may be under-capture, not a diet.`,
      oneMove: 'Capture remaining meals with a photo before judging the week plan.',
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
    cause: `${Math.round(kcal)} kcal · ${Math.round(proteinG)}g protein across ${entryCount} item${entryCount === 1 ? '' : 's'}.`,
    oneMove: 'No food action required — open Training for this week’s plan if you want the next move.',
    coverage: 'ok',
  }
}
