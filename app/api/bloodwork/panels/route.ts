import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type MarkerInput = {
  code: string
  label: string
  valueNum?: number | null
  valueText?: string | null
  unit?: string | null
  refLow?: number | null
  refHigh?: number | null
  sortOrder?: number | null
}

function cleanStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

/** List lab panels, newest draw first. */
export async function GET() {
  try {
    const panels = await prisma.bloodworkPanel.findMany({
      orderBy: { drawDate: 'desc' },
      include: {
        _count: { select: { markers: true } },
      },
    })
    return NextResponse.json(
      panels.map(p => ({
        id: p.id,
        drawDate: p.drawDate,
        labName: p.labName,
        fasting: p.fasting,
        notes: p.notes,
        markerCount: p._count.markers,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    )
  } catch (e) {
    console.error('[bloodwork/panels GET]', e)
    return NextResponse.json({ error: 'Failed to list panels' }, { status: 500 })
  }
}

/** Create a panel and optional markers in one transaction. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      drawDate?: string
      labName?: string | null
      fasting?: boolean
      notes?: string | null
      markers?: MarkerInput[]
    } | null

    const drawDate = cleanStr(body?.drawDate)
    if (!drawDate || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
      return NextResponse.json({ error: 'drawDate must be yyyy-mm-dd' }, { status: 400 })
    }

    const markersRaw = Array.isArray(body?.markers) ? body!.markers! : []
    const markers = markersRaw
      .map((m, i) => {
        const code = cleanStr(m.code)?.toLowerCase().replace(/\s+/g, '_')
        const label = cleanStr(m.label)
        if (!code || !label) return null
        return {
          code,
          label,
          valueNum: toNum(m.valueNum),
          valueText: cleanStr(m.valueText),
          unit: cleanStr(m.unit),
          refLow: toNum(m.refLow),
          refHigh: toNum(m.refHigh),
          sortOrder: typeof m.sortOrder === 'number' && Number.isFinite(m.sortOrder) ? m.sortOrder : i,
        }
      })
      .filter(Boolean) as Array<{
      code: string
      label: string
      valueNum: number | null
      valueText: string | null
      unit: string | null
      refLow: number | null
      refHigh: number | null
      sortOrder: number
    }>

    const panel = await prisma.bloodworkPanel.create({
      data: {
        drawDate,
        labName: cleanStr(body?.labName),
        fasting: Boolean(body?.fasting),
        notes: cleanStr(body?.notes),
        markers: markers.length
          ? {
              create: markers,
            }
          : undefined,
      },
      include: { markers: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json(panel)
  } catch (e) {
    console.error('[bloodwork/panels POST]', e)
    return NextResponse.json({ error: 'Failed to create panel' }, { status: 500 })
  }
}
