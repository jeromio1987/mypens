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

function serialize(row: {
  id: string
  tier: string
  labsWearableContextEnabled: boolean
  labsLongevityLensEnabled: boolean
  heightCm: number | null
  birthYear: number | null
  sex: string | null
  hrMax: number | null
  updatedAt: Date
}) {
  return {
    id: row.id,
    tier: row.tier === 'premium' ? 'premium' : 'free',
    labsWearableContextEnabled: row.labsWearableContextEnabled,
    labsLongevityLensEnabled: row.labsLongevityLensEnabled,
    heightCm: row.heightCm,
    birthYear: row.birthYear,
    sex: row.sex,
    hrMax: row.hrMax,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const row = await getOrCreateSettings()
    return NextResponse.json(serialize(row))
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
      heightCm?: number | null
      birthYear?: number | null
      sex?: string | null
      hrMax?: number | null
    } | null

    const tierRaw = body?.tier
    const hasTier = tierRaw !== undefined
    if (hasTier && tierRaw !== 'free' && tierRaw !== 'premium') {
      return NextResponse.json({ error: 'tier must be "free" or "premium"' }, { status: 400 })
    }

    const hasCtx = body?.labsWearableContextEnabled !== undefined
    const hasLen = body?.labsLongevityLensEnabled !== undefined
    const hasHeight = body?.heightCm !== undefined
    const hasBirth = body?.birthYear !== undefined
    const hasSex = body?.sex !== undefined
    const hasHrMax = body?.hrMax !== undefined

    if (!hasTier && !hasCtx && !hasLen && !hasHeight && !hasBirth && !hasSex && !hasHrMax) {
      return NextResponse.json(
        {
          error:
            'Provide tier, labs flags, heightCm, birthYear, sex, and/or hrMax',
        },
        { status: 400 },
      )
    }

    let hrMax: number | null | undefined
    if (hasHrMax) {
      if (body!.hrMax === null) {
        hrMax = null
      } else {
        const n = Number(body!.hrMax)
        if (!Number.isFinite(n) || n < 120 || n > 230) {
          return NextResponse.json(
            { error: 'hrMax must be null or an integer 120–230' },
            { status: 400 },
          )
        }
        hrMax = Math.round(n)
      }
    }

    let heightCm: number | null | undefined
    if (hasHeight) {
      if (body!.heightCm === null) {
        heightCm = null
      } else {
        const n = Number(body!.heightCm)
        if (!Number.isFinite(n) || n < 100 || n > 250) {
          return NextResponse.json(
            { error: 'heightCm must be null or 100–250' },
            { status: 400 },
          )
        }
        heightCm = n
      }
    }

    let birthYear: number | null | undefined
    if (hasBirth) {
      if (body!.birthYear === null) {
        birthYear = null
      } else {
        const n = Number(body!.birthYear)
        const y = new Date().getFullYear()
        if (!Number.isFinite(n) || n < 1920 || n > y - 10) {
          return NextResponse.json(
            { error: `birthYear must be null or 1920–${y - 10}` },
            { status: 400 },
          )
        }
        birthYear = Math.round(n)
      }
    }

    let sex: string | null | undefined
    if (hasSex) {
      if (body!.sex === null || body!.sex === '') {
        sex = null
      } else if (body!.sex === 'male' || body!.sex === 'female') {
        sex = body!.sex
      } else {
        return NextResponse.json({ error: 'sex must be male, female, or null' }, { status: 400 })
      }
    }

    await getOrCreateSettings()
    const updated = await prisma.userSettings.update({
      where: { id: DEFAULT_ID },
      data: {
        ...(hasTier && { tier: tierRaw }),
        ...(hasCtx && { labsWearableContextEnabled: Boolean(body!.labsWearableContextEnabled) }),
        ...(hasLen && { labsLongevityLensEnabled: Boolean(body!.labsLongevityLensEnabled) }),
        ...(hasHeight && { heightCm }),
        ...(hasBirth && { birthYear }),
        ...(hasSex && { sex }),
        ...(hasHrMax && { hrMax }),
      },
    })
    return NextResponse.json(serialize(updated))
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
