export interface WeightBreakdown {
  scaleKg: number
  creatineKg: number
  alcoholKg: number
  glycogenKg: number
  trueWeightKg: number
  tanitaReliable: boolean
  tanitaFlags: string[]
}

export function estimateCreatineRetention(doseG: number, daysOn: number) {
  if (doseG === 0 || daysOn === 0) return { retentionKg: 0, phase: 'none' }
  const isLoading = doseG >= 10
  if (isLoading) {
    const ramp = Math.min(daysOn / 7, 1)
    return { retentionKg: parseFloat((ramp * 1.0).toFixed(2)), phase: 'loading' }
  }
  const saturation = Math.min(daysOn / 28, 1)
  return {
    retentionKg: parseFloat((saturation * 0.4).toFixed(2)),
    phase: saturation >= 0.9 ? 'saturated' : 'maintenance',
  }
}

export function estimateAlcoholImpact(units: number, hoursSince: number) {
  if (units === 0) return { retentionKg: 0, kcal: 0, fatBurnSuppressed: false, hoursImpaired: 0 }
  const kcal = Math.round(units * 56)
  const retentionPeakKg = units * 0.25
  const decayFactor = Math.max(0, 1 - hoursSince / 48)
  const retentionKg = parseFloat((retentionPeakKg * decayFactor).toFixed(2))
  const hoursImpaired = Math.max(0, units - hoursSince)
  return { retentionKg, kcal, fatBurnSuppressed: hoursImpaired > 0, hoursImpaired }
}

export function estimateGlycogenRetention(carbsG: number) {
  if (carbsG === 0) return { retentionKg: 0 }
  const excessCarbs = Math.max(0, carbsG - 150)
  const waterBoundG = excessCarbs * 0.5 * 3.5
  return { retentionKg: parseFloat((waterBoundG / 1000).toFixed(2)) }
}

export function assessTanitaReliability(ctx: {
  creatineDoseG: number
  creatineDaysOn: number
  hoursSinceAlcohol: number
  hardTraining: boolean
  morningReading: boolean
}) {
  const flags: string[] = []
  if (ctx.creatineDoseG >= 10 && ctx.creatineDaysOn <= 14)
    flags.push('Creatine loading active — fat% likely overstated')
  else if (ctx.creatineDoseG > 0 && ctx.creatineDaysOn > 0)
    flags.push('Creatine maintenance — minor BIA distortion')
  if (ctx.hoursSinceAlcohol < 24) flags.push('Alcohol within 24h — dehydration skews reading')
  if (ctx.hardTraining) flags.push('Hard training yesterday — transient inflammation')
  if (!ctx.morningReading) flags.push('Best accuracy: fasted morning, post-toilet')
  return { reliable: flags.length === 0, flags }
}

export function calculateWeightBreakdown(input: {
  scaleKg: number
  creatineDoseG: number
  creatineDaysOn: number
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  hardTraining: boolean
  morningReading: boolean
}): WeightBreakdown {
  const creatine = estimateCreatineRetention(input.creatineDoseG, input.creatineDaysOn)
  const alcohol = estimateAlcoholImpact(input.alcoholUnits, input.hoursSinceAlcohol)
  const glycogen = estimateGlycogenRetention(input.carbsG)
  const tanita = assessTanitaReliability(input)
  const total = creatine.retentionKg + alcohol.retentionKg + glycogen.retentionKg
  return {
    scaleKg: input.scaleKg,
    creatineKg: creatine.retentionKg,
    alcoholKg: alcohol.retentionKg,
    glycogenKg: glycogen.retentionKg,
    trueWeightKg: parseFloat((input.scaleKg - total).toFixed(2)),
    tanitaReliable: tanita.reliable,
    tanitaFlags: tanita.flags,
  }
}
