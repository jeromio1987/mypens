/**
 * Intensity-weighted training load (Pens Load Units / PLU).
 *
 * Raw minutes treat a 90‑min walk like a 90‑min threshold run. PLU down-weights
 * easy locomotion and up-weights hard sports + heart-rate intensity.
 *
 *   PLU ≈ minutes × sportWeight × hrIntensity
 *
 * hrIntensity uses a Banister-style TRIMP factor when avgHr is present:
 *   ΔHR = (HRavg − HRrest) / (HRmax − HRrest)
 *   trimp = ΔHR × 0.64 × e^(1.92 × ΔHR)   (male exponential)
 * then blended with sportWeight so walks stay cheap even with elevated HR.
 *
 * Defaults: HRrest=50, HRmax=185 (override per day when resting_hr exists).
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function round1(n) {
  return Math.round(n * 10) / 10
}

/** @typedef {'walk'|'hike'|'cycle'|'run'|'trail'|'swim'|'strength'|'hiit'|'cardio'|'other'|'rest'} SportClass */

const SPORT_WEIGHT = {
  walk: 0.22,
  hike: 0.4,
  cycle: 0.9,
  run: 1.0,
  trail: 1.1,
  swim: 1.05,
  strength: 1.15,
  hiit: 1.25,
  cardio: 0.85,
  other: 0.65,
  rest: 0,
}

/**
 * Classify Garmin/Strava sport strings into a load bucket.
 * @param {string} [sport]
 * @param {string} [subSport]
 * @param {string} [name]
 * @returns {SportClass}
 */
export function classifySport(sport, subSport, name) {
  const blob = `${sport || ''} ${subSport || ''} ${name || ''}`.toLowerCase()

  if (/\b(walk|walking|steps|casual walk|dog walk)\b/.test(blob)) return 'walk'
  if (/\b(hike|hiking|mountaineering)\b/.test(blob)) return 'hike'
  if (/\b(trail[\s_-]?run|trail running)\b/.test(blob)) return 'trail'
  if (/\b(run|running|jog|treadmill)\b/.test(blob)) return 'run'
  if (/\b(cycl\w*|bike|biking|ride|indoor[\s_-]?cycl\w*|spin)\b/.test(blob)) return 'cycle'
  if (/\b(swim|pool|open[\s_-]?water)\b/.test(blob)) return 'swim'
  if (/\b(hiit|tabata|crossfit|circuit|boot[\s_-]?camp)\b/.test(blob)) return 'hiit'
  if (
    /\b(strength|weight|gym|lift|resistance|train|workout|yoga|pilates|row[\s_-]?erg|rower)\b/.test(
      blob,
    )
  ) {
    return 'strength'
  }
  if (/\b(elliptical|cardio|aerobics|stair|step[\s_-]?mill)\b/.test(blob)) return 'cardio'
  if (/\b(rest|recovery|stretch|mobility)\b/.test(blob)) return 'rest'
  return 'other'
}

/**
 * Banister-ish intensity multiplier from average HR.
 * @returns {number} roughly 0.35–1.9
 */
export function hrIntensityFactor(avgHr, { restingHr = 50, hrMax = 185 } = {}) {
  if (avgHr == null || !(avgHr > 0) || hrMax <= restingHr) return null
  const ratio = clamp((Number(avgHr) - restingHr) / (hrMax - restingHr), 0, 1.05)
  const trimp = ratio * 0.64 * Math.exp(1.92 * ratio) // ~0 … ~2.4 at max
  // Map so easy (~0.3 ΔHR) ≈ 0.55 and hard (~0.85 ΔHR) ≈ 1.55
  return clamp(0.35 + (trimp / 2.2) * 1.55, 0.35, 1.9)
}

/**
 * Load contribution for one Garmin (or Garmin-like) activity.
 * @param {{ sport?: string, subSport?: string, name?: string, durationSec?: number, avgHr?: number|null, calories?: number|null }} activity
 * @param {{ restingHr?: number|null, hrMax?: number }} [opts]
 */
export function activityLoad(activity, opts = {}) {
  const minutes = Math.max(0, (Number(activity.durationSec) || 0) / 60)
  if (minutes <= 0) return { load: 0, minutes: 0, sportClass: 'other', sportWeight: 0 }

  const sportClass = classifySport(activity.sport, activity.subSport, activity.name)
  const sportWeight = SPORT_WEIGHT[sportClass] ?? SPORT_WEIGHT.other
  if (sportClass === 'rest' || sportWeight <= 0) {
    return { load: 0, minutes: round1(minutes), sportClass, sportWeight: 0 }
  }

  const hrF = hrIntensityFactor(activity.avgHr, {
    restingHr: opts.restingHr ?? 50,
    hrMax: opts.hrMax ?? 185,
  })

  let intensity
  if (hrF != null) {
    // Walks: keep HR soft — elevated HR on a walk still shouldn't score like a run
    if (sportClass === 'walk') intensity = sportWeight * (0.55 + 0.45 * Math.min(hrF, 1.1))
    else if (sportClass === 'hike') intensity = sportWeight * (0.6 + 0.5 * Math.min(hrF, 1.2))
    else if (sportClass === 'strength') intensity = sportWeight * (0.75 + 0.35 * Math.min(hrF, 1.3))
    else intensity = sportWeight * hrF
  } else {
    // No HR: pure sport prior (walk stays ~0.22× minutes)
    intensity = sportWeight
  }

  // Soft calorie nudge when duration is short but kcal high (HIIT mislabelled)
  const kcal = Number(activity.calories)
  if (kcal > 0 && minutes > 0) {
    const kcalPerMin = kcal / minutes
    if (kcalPerMin >= 12 && sportClass === 'walk') intensity *= 1.15
    if (kcalPerMin >= 14 && (sportClass === 'other' || sportClass === 'cardio')) intensity *= 1.1
  }

  return {
    load: round1(minutes * intensity),
    minutes: round1(minutes),
    sportClass,
    sportWeight,
    intensity: round1(intensity),
  }
}

/**
 * Load for a TrainingEntry (gym/Strava without full Garmin fields).
 * Prefers RPE × duration; falls back to volume proxy.
 */
export function trainingEntryLoad(entry) {
  const sportClass = classifySport(entry.exercise, entry.source, entry.notes)
  const sportWeight = SPORT_WEIGHT[sportClass] ?? SPORT_WEIGHT.strength

  let minutes =
    typeof entry.durationSec === 'number'
      ? entry.durationSec / 60
      : typeof entry.durationMin === 'number'
        ? entry.durationMin
        : null

  if (minutes == null) {
    // Volume proxy: 2000 kg·reps ≈ ~45 soft minutes of strength stimulus
    const vol = Number(entry.volume) || 0
    minutes = Math.max(20, Math.min(90, Math.round((vol / 2000) * 10) || 45))
  }

  const rpe = Number(entry.rpe)
  let intensity = sportWeight
  if (rpe > 0) {
    // RPE 5 → ~0.7×, RPE 8 → ~1.15×, RPE 10 → ~1.4× relative to sport
    intensity = sportWeight * clamp(0.35 + (rpe / 10) * 1.05, 0.4, 1.5)
  } else if (sportClass === 'walk') {
    intensity = SPORT_WEIGHT.walk
  }

  return {
    load: round1(minutes * intensity),
    minutes: round1(minutes),
    sportClass,
    sportWeight,
    intensity: round1(intensity),
  }
}

/**
 * Aggregate daily load from activities + training rows.
 * @returns {{ trainingLoad: number, activityMinutes: number, hardLoad: number, easyLoad: number, bySport: Record<string, number> }}
 */
export function dayTrainingLoad(activities = [], trainings = [], opts = {}) {
  let trainingLoad = 0
  let activityMinutes = 0
  let hardLoad = 0
  let easyLoad = 0
  /** @type {Record<string, number>} */
  const bySport = {}

  for (const a of activities) {
    const r = activityLoad(a, opts)
    trainingLoad += r.load
    activityMinutes += r.minutes
    bySport[r.sportClass] = round1((bySport[r.sportClass] || 0) + r.load)
    if (r.sportClass === 'walk' || r.sportClass === 'hike' || r.sportClass === 'cardio') {
      easyLoad += r.load
    } else {
      hardLoad += r.load
    }
  }
  for (const t of trainings) {
    const r = trainingEntryLoad(t)
    trainingLoad += r.load
    activityMinutes += r.minutes
    bySport[r.sportClass] = round1((bySport[r.sportClass] || 0) + r.load)
    if (r.sportClass === 'walk' || r.sportClass === 'hike') easyLoad += r.load
    else hardLoad += r.load
  }

  return {
    trainingLoad: round1(trainingLoad),
    activityMinutes: Math.round(activityMinutes),
    hardLoad: round1(hardLoad),
    easyLoad: round1(easyLoad),
    bySport,
  }
}

export const TRAINING_LOAD_META = {
  unit: 'PLU',
  label: 'Pens Load Units',
  formula:
    'minutes × sportWeight × HR-intensity (Banister-style when avgHr present; walks weighted ~0.22)',
}
