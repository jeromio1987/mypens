import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const DEFAULT_ID = 'default'

async function getOrCreateSettings() {
  const existing = await prisma.userSettings.findUnique({
    where: { id: DEFAULT_ID },
  })
  if (existing) return existing
  return prisma.userSettings.create({
    data: { id: DEFAULT_ID, tier: 'free' },
  })
}

export async function GET() {
  try {
    const row = await getOrCreateSettings()
    return NextResponse.json({
      id: row.id,
      tier: row.tier === 'premium' ? 'premium' : 'free',
      labsWearableContextEnabled: row.labsWearableContextEnabled,
      labsLongevityLensEnabled: row.labsLongevityLensEnabled,
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      tier?: string
      labsWearableContextEnabled?: boolean
      labsLongevityLensEnabled?: boolean
    } | null

    const tierRaw = body?.tier
    const hasTier = tierRaw !== undefined
    if (hasTier && tierRaw !== 'free' && tierRaw !== 'premium') {
      return NextResponse.json({ error: 'tier must be "free" or "premium"' }, { status: 400 })
    }

    const hasCtx = body?.labsWearableContextEnabled !== undefined
    const hasLen = body?.labsLongevityLensEnabled !== undefined
    if (!hasTier && !hasCtx && !hasLen) {
      return NextResponse.json(
        { error: 'Provide tier and/or labsWearableContextEnabled and/or labsLongevityLensEnabled' },
        { status: 400 },
      )
    }

    await getOrCreateSettings()
    const updated = await prisma.userSettings.update({
      where: { id: DEFAULT_ID },
      data: {
        ...(hasTier && { tier: tierRaw }),
        ...(hasCtx && { labsWearableContextEnabled: Boolean(body!.labsWearableContextEnabled) }),
        ...(hasLen && { labsLongevityLensEnabled: Boolean(body!.labsLongevityLensEnabled) }),
      },
    })
    return NextResponse.json({
      id: updated.id,
      tier: updated.tier === 'premium' ? 'premium' : 'free',
      labsWearableContextEnabled: updated.labsWearableContextEnabled,
      labsLongevityLensEnabled: updated.labsLongevityLensEnabled,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
