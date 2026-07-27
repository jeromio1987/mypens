import { SIGNAL_CONFIG, type SignalId } from './signalConfig'
import type { RefFlag } from '@/lib/bloodworkFlags'

export type SignalDay = {
  date: string
  sleepHours?: number | null
  restingHr?: number | null
  trainingLoad?: number | null
  kcalIn?: number | null
  proteinG?: number | null
  foodLogged?: boolean
  energyDelta?: number | null
  scaleKg?: number | null
}

/** Soft lab markers from latest panel — never medical advice. */
export type LabSignalContext = {
  drawDate?: string | null
  ferritinFlag?: RefFlag | null
  tshFlag?: RefFlag | null
  /** Calendar days since drawDate (soft age cue). */
  panelAgeDays?: number | null
}

export type SignalHit = {
  id: SignalId
  label: string
  severity: 'info' | 'watch' | 'high'
  evidence: string
  confidenceDays: number
  unknowns: string[]
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** WP 4.1 — pure detection over cockpit-like days (+ optional soft lab context). */
export function detectSignals(days: SignalDay[], labs?: LabSignalContext | null): SignalHit[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const hits: SignalHit[] = []
  const byId = Object.fromEntries(SIGNAL_CONFIG.map(c => [c.id, c])) as Record<
    SignalId,
    (typeof SIGNAL_CONFIG)[number]
  >

  // food_coverage_drop
  {
    const cfg = byId.food_coverage_drop
    const win = sorted.slice(-cfg.windowDays)
    const logged = win.filter(d => d.foodLogged).length
    const unknowns: string[] = []
    if (win.length < cfg.windowDays) unknowns.push(`Only ${win.length}/${cfg.windowDays} days in series`)
    if (logged < cfg.params.minLoggedDays) {
      hits.push({
        id: cfg.id,
        label: cfg.label,
        severity: 'watch',
        evidence: `${logged} food-logged days in last ${win.length} (need ≥${cfg.params.minLoggedDays})`,
        confidenceDays: win.length,
        unknowns,
      })
    }
  }

  // sleep_below_norm
  {
    const cfg = byId.sleep_below_norm
    const win = sorted.slice(-cfg.windowDays)
    const low = win.filter(d => d.sleepHours != null && d.sleepHours < cfg.params.minHours)
    const measured = win.filter(d => d.sleepHours != null)
    const unknowns: string[] = []
    if (measured.length < cfg.params.minNights) {
      unknowns.push(`Only ${measured.length} nights with hours`)
    }
    if (low.length >= cfg.params.minNights) {
      hits.push({
        id: cfg.id,
        label: cfg.label,
        severity: 'high',
        evidence: `${low.length} nights under ${cfg.params.minHours}h`,
        confidenceDays: measured.length,
        unknowns,
      })
    }
  }

  // protein_below_target
  {
    const cfg = byId.protein_below_target
    const win = sorted.slice(-cfg.windowDays).filter(d => d.foodLogged)
    const under = win.filter(d => (d.proteinG ?? 0) < cfg.params.targetG)
    if (under.length >= cfg.params.minDays) {
      hits.push({
        id: cfg.id,
        label: cfg.label,
        severity: 'watch',
        evidence: `${under.length} logged days under ${cfg.params.targetG}g protein`,
        confidenceDays: win.length,
        unknowns: win.length < cfg.params.minDays ? ['Sparse food log'] : [],
      })
    }
  }

  // load spike / drop
  {
    const cfgSpike = byId.load_spike
    const cfgDrop = byId.load_drop
    const recent = sorted.slice(-7)
    const prior = sorted.slice(-14, -7)
    const sum = (rows: SignalDay[]) => rows.reduce((a, d) => a + (d.trainingLoad || 0), 0)
    const r = sum(recent)
    const p = sum(prior)
    if (p > 0 && r >= p * cfgSpike.params.ratio) {
      hits.push({
        id: cfgSpike.id,
        label: cfgSpike.label,
        severity: 'watch',
        evidence: `Load ${Math.round(r)} vs prior ${Math.round(p)} (≥${cfgSpike.params.ratio}×)`,
        confidenceDays: recent.length + prior.length,
        unknowns: prior.length < 5 ? ['Short prior window'] : [],
      })
    }
    if (p > 50 && r <= p * cfgDrop.params.ratio) {
      hits.push({
        id: cfgDrop.id,
        label: cfgDrop.label,
        severity: 'info',
        evidence: `Load ${Math.round(r)} vs prior ${Math.round(p)} (≤${cfgDrop.params.ratio}×)`,
        confidenceDays: recent.length + prior.length,
        unknowns: [],
      })
    }
  }

  // rhr elevated
  {
    const cfg = byId.rhr_elevated
    const recent = sorted.slice(-7).map(d => d.restingHr).filter((n): n is number => n != null)
    const prior = sorted.slice(-14, -7).map(d => d.restingHr).filter((n): n is number => n != null)
    const mr = mean(recent)
    const mp = mean(prior)
    if (mr != null && mp != null && mr >= mp + cfg.params.deltaBpm) {
      hits.push({
        id: cfg.id,
        label: cfg.label,
        severity: 'high',
        evidence: `Mean RHR ${mr.toFixed(0)} vs prior ${mp.toFixed(0)} (+${cfg.params.deltaBpm} bpm)`,
        confidenceDays: recent.length + prior.length,
        unknowns: recent.length < 4 || prior.length < 4 ? ['Thin RHR sample'] : [],
      })
    }
  }

  // weight stall vs deficit
  {
    const cfg = byId.weight_stall_vs_deficit
    const win = sorted.slice(-cfg.windowDays)
    const deltas = win.map(d => d.energyDelta).filter((n): n is number => n != null)
    const weights = win.map(d => d.scaleKg).filter((n): n is number => n != null)
    const unknowns: string[] = []
    if (deltas.length < 5) unknowns.push(`Only ${deltas.length} days with energyDelta`)
    if (weights.length < 2) unknowns.push('Need ≥2 scale readings')
    const meanDelta = mean(deltas)
    if (meanDelta != null && meanDelta <= cfg.params.minDeficitKcal && weights.length >= 2) {
      const change = weights[weights.length - 1]! - weights[0]!
      if (Math.abs(change) < cfg.params.maxAbsKgChange) {
        hits.push({
          id: cfg.id,
          label: cfg.label,
          severity: 'watch',
          evidence: `Δkg ${change.toFixed(2)} with mean energy Δ ${Math.round(meanDelta)} kcal`,
          confidenceDays: Math.min(deltas.length, weights.length),
          unknowns,
        })
      }
    }
  }

  // Soft lab confounders (optional context — never rewrite energy from labs)
  if (labs) {
    const recent = sorted.slice(-7)
    const prior = sorted.slice(-14, -7)
    const sum = (rows: SignalDay[]) => rows.reduce((a, d) => a + (d.trainingLoad || 0), 0)
    const r = sum(recent)
    const p = sum(prior)
    const ageNote =
      labs.panelAgeDays != null && labs.panelAgeDays > 90
        ? `Panel age ${labs.panelAgeDays}d`
        : labs.drawDate
          ? `Draw ${labs.drawDate}`
          : 'Latest panel'

    {
      const cfg = byId.iron_low_vs_load
      if (labs.ferritinFlag === 'below' && p > 0 && r >= p * cfg.params.loadRatio) {
        const unknowns: string[] = [
          'Soft confounder only — not iron deficiency diagnosis',
          ageNote,
        ]
        if (prior.length < 5) unknowns.push('Short prior load window')
        hits.push({
          id: cfg.id,
          label: cfg.label,
          severity: 'watch',
          evidence: `Ferritin below listed ref · load ${Math.round(r)} vs prior ${Math.round(p)} (≥${cfg.params.loadRatio}×)`,
          confidenceDays: recent.length + prior.length,
          unknowns,
        })
      }
    }

    {
      const cfg = byId.thyroid_out_of_ref
      if (labs.tshFlag === 'below' || labs.tshFlag === 'above') {
        hits.push({
          id: cfg.id,
          label: cfg.label,
          severity: 'info',
          evidence: `TSH ${labs.tshFlag} listed ref (${ageNote}) — context only; BMR unchanged`,
          confidenceDays: 1,
          unknowns: [
            'Educational soft-read — not thyroid diagnosis or treatment advice',
            ageNote,
          ],
        })
      }
    }
  }

  return hits
}
