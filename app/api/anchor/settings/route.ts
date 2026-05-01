import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// Singleton row id we always read/write.
const SETTINGS_ID = 'default'

async function ensureSettings() {
  let s = await prisma.recoverySettings.findUnique({ where: { id: SETTINGS_ID } })
  if (!s) {
    s = await prisma.recoverySettings.create({ data: { id: SETTINGS_ID } })
  }
  return s
}

export async function GET() {
  const s = await ensureSettings()
  return NextResponse.json(s)
}

interface SettingsPatch {
  drinkCostEur?: number
  cocaineGramEur?: number
  escortNightEur?: number
  baselineDrinksPerWeek?: number
  baselineCocaineGramsPerMonth?: number
  baselineEscortsPerMonth?: number
  resetStartDate?: string
  phase1ResetDays?: number
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as SettingsPatch
    await ensureSettings()
    const data: SettingsPatch = {}
    if (body.drinkCostEur !== undefined) data.drinkCostEur = Number(body.drinkCostEur)
    if (body.cocaineGramEur !== undefined) data.cocaineGramEur = Number(body.cocaineGramEur)
    if (body.escortNightEur !== undefined) data.escortNightEur = Number(body.escortNightEur)
    if (body.baselineDrinksPerWeek !== undefined) data.baselineDrinksPerWeek = Number(body.baselineDrinksPerWeek)
    if (body.baselineCocaineGramsPerMonth !== undefined) data.baselineCocaineGramsPerMonth = Number(body.baselineCocaineGramsPerMonth)
    if (body.baselineEscortsPerMonth !== undefined) data.baselineEscortsPerMonth = Number(body.baselineEscortsPerMonth)
    if (body.resetStartDate !== undefined) data.resetStartDate = String(body.resetStartDate)
    if (body.phase1ResetDays !== undefined) data.phase1ResetDays = Number(body.phase1ResetDays)
    const s = await prisma.recoverySettings.update({ where: { id: SETTINGS_ID }, data })
    return NextResponse.json(s)
  } catch (err) {
    console.error('[anchor/settings PATCH]', err)
    return NextResponse.json({ error: 'failed to update' }, { status: 500 })
  }
}
