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
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { tier?: string } | null
    const tierRaw = body?.tier
    if (tierRaw !== 'free' && tierRaw !== 'premium') {
      return NextResponse.json({ error: 'tier must be "free" or "premium"' }, { status: 400 })
    }
    await getOrCreateSettings()
    const updated = await prisma.userSettings.update({
      where: { id: DEFAULT_ID },
      data: { tier: tierRaw },
    })
    return NextResponse.json({
      id: updated.id,
      tier: updated.tier === 'premium' ? 'premium' : 'free',
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
