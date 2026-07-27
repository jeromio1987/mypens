/**
 * Body phase persistence — UserSettings (Prisma).
 * One-shot migrates legacy data/body_phase.json if present.
 */

import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import {
  defaultPhaseState,
  isBodyPhase,
  type BodyPhase,
  type BodyPhaseState,
} from '@/lib/bodyPhase'
import { today as todayLocal } from '@/lib/timeWindow'

const DEFAULT_ID = 'default'
const LEGACY_FILE = path.join(process.cwd(), 'data', 'body_phase.json')

const BODY_PHASE_SELECT = {
  bodyPhase: true,
  bodyPhaseStartedAt: true,
  bodyPhaseKgPerWeek: true,
  bodyPhaseExpectedEndAt: true,
} as const

async function ensureSettings() {
  const existing = await prisma.userSettings.findUnique({
    where: { id: DEFAULT_ID },
    select: BODY_PHASE_SELECT,
  })
  if (existing) return existing
  await prisma.userSettings.create({ data: { id: DEFAULT_ID, tier: 'free' } })
  return prisma.userSettings.findUniqueOrThrow({
    where: { id: DEFAULT_ID },
    select: BODY_PHASE_SELECT,
  })
}

function rowToState(row: {
  bodyPhase: string
  bodyPhaseStartedAt: string | null
  bodyPhaseKgPerWeek: number
  bodyPhaseExpectedEndAt: string | null
}): BodyPhaseState {
  const today = todayLocal()
  if (!isBodyPhase(row.bodyPhase)) return defaultPhaseState(today)
  return {
    phase: row.bodyPhase,
    startedAt: row.bodyPhaseStartedAt || today,
    kgPerWeek: typeof row.bodyPhaseKgPerWeek === 'number' ? row.bodyPhaseKgPerWeek : 0.4,
    expectedEndAt: row.bodyPhaseExpectedEndAt ?? null,
  }
}

/** Import legacy JSON once, then rename the file so we don't re-import. */
async function maybeMigrateLegacyFile(): Promise<void> {
  try {
    if (!fs.existsSync(LEGACY_FILE)) return
    const raw = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8')) as Partial<BodyPhaseState>
    if (!isBodyPhase(raw.phase)) {
      fs.renameSync(LEGACY_FILE, `${LEGACY_FILE}.migrated-invalid`)
      return
    }
    await ensureSettings()
    await prisma.userSettings.update({
      where: { id: DEFAULT_ID },
      data: {
        bodyPhase: raw.phase,
        bodyPhaseStartedAt: raw.startedAt || todayLocal(),
        bodyPhaseKgPerWeek: typeof raw.kgPerWeek === 'number' ? raw.kgPerWeek : 0.4,
        bodyPhaseExpectedEndAt: raw.expectedEndAt ?? null,
      },
      select: { id: true },
    })
    fs.renameSync(LEGACY_FILE, `${LEGACY_FILE}.migrated`)
  } catch {
    /* leave file; DB defaults still work */
  }
}

let migrateOnce: Promise<void> | null = null
function migrateOnceFn() {
  if (!migrateOnce) migrateOnce = maybeMigrateLegacyFile()
  return migrateOnce
}

export async function readBodyPhase(): Promise<BodyPhaseState> {
  await migrateOnceFn()
  const row = await ensureSettings()
  return rowToState(row)
}

export async function writeBodyPhase(next: {
  phase: BodyPhase
  kgPerWeek?: number
  startedAt?: string
  expectedEndAt?: string | null
}): Promise<BodyPhaseState> {
  await migrateOnceFn()
  const prev = await readBodyPhase()
  const phaseChanged = next.phase !== prev.phase
  const startedAt = next.startedAt || (phaseChanged ? todayLocal() : prev.startedAt)
  const kgPerWeek = next.kgPerWeek ?? prev.kgPerWeek
  const expectedEndAt =
    next.expectedEndAt !== undefined ? next.expectedEndAt : prev.expectedEndAt

  await ensureSettings()
  const row = await prisma.userSettings.update({
    where: { id: DEFAULT_ID },
    data: {
      bodyPhase: next.phase,
      bodyPhaseStartedAt: startedAt,
      bodyPhaseKgPerWeek: kgPerWeek,
      bodyPhaseExpectedEndAt: expectedEndAt,
    },
    select: BODY_PHASE_SELECT,
  })
  return rowToState(row)
}
