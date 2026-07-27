/**
 * BMR estimates for the energy ledger.
 * Prefer Katch–McArdle when measured body fat % is available (Tanita / composition);
 * else Mifflin–St Jeor when height/age/sex + weight are available;
 * otherwise ~22 kcal/kg stub. Always labeled as estimate — not lab RMR.
 * Labs (TSH etc.) never rewrite BMR.
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
  method: 'katch_mcardle' | 'mifflin_st_jeor' | 'stub_22kcal_kg' | 'missing'
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

/** Plausible measured BF% for Katch–McArdle (composition scale). */
export function isPlausibleBodyFatPct(bodyFatPct: number | null | undefined): bodyFatPct is number {
  return bodyFatPct != null && Number.isFinite(bodyFatPct) && bodyFatPct > 3 && bodyFatPct < 60
}

/** Katch–McArdle from lean mass (kcal/day). */
export function katchMcardleKcal(weightKg: number, bodyFatPct: number): number {
  const ffm = weightKg * (1 - bodyFatPct / 100)
  return Math.round(370 + 21.6 * ffm)
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

/**
 * @param bodyFatPct Optional measured BF% (e.g. Tanita). When present and plausible,
 * prefers Katch–McArdle over Mifflin — composition-based only, never from labs.
 */
export function estimateBmrDetailed(
  weightKg: number | null | undefined,
  profile?: BmrProfile | null,
  bodyFatPct?: number | null,
): BmrEstimate {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { kcal: 0, method: 'missing', label: 'BMR missing (no weight)' }
  }

  if (isPlausibleBodyFatPct(bodyFatPct)) {
    return {
      kcal: katchMcardleKcal(weightKg, bodyFatPct),
      method: 'katch_mcardle',
      label: 'BMR estimate (Katch–McArdle)',
    }
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
