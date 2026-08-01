/**
 * WP 4.4 — intervention trials (file store; no live migrate required).
 * Outcome: pending | yes | no | unknown after horizonDays.
 */

import fs from 'fs'
import path from 'path'
import { shiftDateStr, today } from '@/lib/timeWindow'

export type TrialOutcome = 'pending' | 'yes' | 'no' | 'unknown'

export type InterventionTrial = {
  id: string
  signalId: string
  action: string
  startedAt: string
  dueAt: string
  outcome: TrialOutcome
  notes: string
}

const DEFAULT_STORE = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'data',
  'intervention_trials.json',
)

/** Override for tests — set null to restore default. */
let storeOverride: string | null = null

export function setTrialStorePathForTests(p: string | null) {
  storeOverride = p
}

function storePath() {
  return storeOverride ?? DEFAULT_STORE
}

function readAll(): InterventionTrial[] {
  try {
    const p = storePath()
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf8')) as InterventionTrial[]
  } catch {
    return []
  }
}

function writeAll(rows: InterventionTrial[]) {
  const p = storePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(rows, null, 2), 'utf8')
}

export function listTrials(): InterventionTrial[] {
  return readAll()
}

export function startTrial(input: {
  signalId: string
  action: string
  horizonDays: number
  notes?: string
  /** Optional clock for tests */
  now?: Date
}): InterventionTrial {
  const startedAt = today(input.now)
  const dueAt = shiftDateStr(startedAt, Math.max(0, Math.floor(input.horizonDays)))
  const row: InterventionTrial = {
    id: `trial_${(input.now ?? new Date()).getTime()}`,
    signalId: input.signalId,
    action: input.action,
    startedAt,
    dueAt,
    outcome: 'pending',
    notes: input.notes ?? '',
  }
  const all = readAll()
  all.push(row)
  writeAll(all)
  return row
}

export function resolveTrial(id: string, outcome: TrialOutcome, notes?: string): InterventionTrial | null {
  const all = readAll()
  const idx = all.findIndex(t => t.id === id)
  if (idx < 0) return null
  all[idx] = {
    ...all[idx]!,
    outcome,
    notes: notes ?? all[idx]!.notes,
  }
  writeAll(all)
  return all[idx]!
}
