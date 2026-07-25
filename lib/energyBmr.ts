/**
 * BMR estimates for the energy ledger.
 * Prefer Mifflin–St Jeor when height/age/sex + weight are available;
 * otherwise ~22 kcal/kg stub. Always labeled as estimate — not lab RMR.
 */

import { BMR_KCAL_PER_KG } from '@/lib/energyWeek'

export type BmrSex = 'male' | 'female'

export type BmrProfile = {
  heightCm?: number | null
  birthYear?: number | null
  sex?: string | null
}

export type BmrEstimate = {
  kcal: number
  method: 'mifflin_st_jeor' | 'stub_22kcal_kg' | 'missing'
  label: string
}

function normalizeSex(raw: string | null | undefined): BmrSex | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (s === 'male' || s === 'm' || s === 'man') return 'male'
  if (s === 'female' || s === 'f' || s === 'woman') return 'female'
  return null
}

export function ageFromBirthYear(
  birthYear: number | null | undefined,
  asOfYear = new Date().getFullYear(),
): number | null {
  if (birthYear == null || !Number.isFinite(birthYear)) return null
  const age = asOfYear - birthYear
  if (age < 10 || age > 120) return null
  return age
}

/** Mifflin–St Jeor (kcal/day). */
export function mifflinStJeorKcal(input: {
  weightKg: number
  heightCm: number
  ageYears: number
  sex: BmrSex
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  return Math.round(input.sex === 'male' ? base + 5 : base - 161)
}

export function estimateBmrDetailed(
  weightKg: number | null | undefined,
  profile?: BmrProfile | null,
): BmrEstimate {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { kcal: 0, method: 'missing', label: 'BMR missing (no weight)' }
  }

  const heightCm = profile?.heightCm
  const age = ageFromBirthYear(profile?.birthYear ?? null)
  const sex = normalizeSex(profile?.sex)
  if (
    heightCm != null &&
    Number.isFinite(heightCm) &&
    heightCm > 100 &&
    heightCm < 250 &&
    age != null &&
    sex
  ) {
    return {
      kcal: mifflinStJeorKcal({ weightKg, heightCm, ageYears: age, sex }),
      method: 'mifflin_st_jeor',
      label: 'BMR estimate (Mifflin–St Jeor)',
    }
  }

  return {
    kcal: Math.round(BMR_KCAL_PER_KG * weightKg),
    method: 'stub_22kcal_kg',
    label: `BMR stub (~${BMR_KCAL_PER_KG} kcal/kg)`,
  }
}
