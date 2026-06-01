import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function cleanStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function toNum(v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const panel = await prisma.bloodworkPanel.findUnique({
      where: { id },
      include: { markers: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    })
    if (!panel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(panel)
  } catch (e) {
    console.error('[bloodwork/panel GET]', e)
    return NextResponse.json({ error: 'Failed to load panel' }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as {
      drawDate?: string
      labName?: string | null
      fasting?: boolean
      notes?: string | null
    } | null

    const data: {
      drawDate?: string
      labName?: string | null
      fasting?: boolean
      notes?: string | null
    } = {}

    if (body?.drawDate !== undefined) {
      const d = cleanStr(body.drawDate)
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return NextResponse.json({ error: 'drawDate must be yyyy-mm-dd' }, { status: 400 })
      }
      data.drawDate = d
    }
    if (body?.labName !== undefined) data.labName = cleanStr(body.labName)
    if (body?.fasting !== undefined) data.fasting = Boolean(body.fasting)
    if (body?.notes !== undefined) data.notes = cleanStr(body.notes)

    const panel = await prisma.bloodworkPanel.update({
      where: { id },
      data,
      include: { markers: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    })
    return NextResponse.json(panel)
  } catch (e) {
    console.error('[bloodwork/panel PATCH]', e)
    return NextResponse.json({ error: 'Failed to update panel' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await prisma.bloodworkPanel.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bloodwork/panel DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete panel' }, { status: 500 })
  }
}

/** Replace markers list (full sync) — POST from client with { markers: [...] } */
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => null)) as { markers?: unknown[] } | null
    const markersRaw = Array.isArray(body?.markers) ? body!.markers! : []

    const markers = markersRaw
      .map((raw, i) => {
        const m = raw as Record<string, unknown>
        const code = cleanStr(m.code)?.toLowerCase().replace(/\s+/g, '_')
        const label = cleanStr(m.label)
        if (!code || !label) return null
        return {
          code,
          label,
          valueNum: toNum(m.valueNum) ?? null,
          valueText: cleanStr(m.valueText),
          unit: cleanStr(m.unit),
          refLow: toNum(m.refLow) ?? null,
          refHigh: toNum(m.refHigh) ?? null,
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

    await prisma.$transaction(async tx => {
      await tx.bloodworkMarker.deleteMany({ where: { panelId: id } })
      if (markers.length > 0) {
        await tx.bloodworkMarker.createMany({
          data: markers.map(m => ({ ...m, panelId: id })),
        })
      }
    })

    const panel = await prisma.bloodworkPanel.findUnique({
      where: { id },
      include: { markers: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
    })
    return NextResponse.json(panel)
  } catch (e) {
    console.error('[bloodwork/panel PUT]', e)
    return NextResponse.json({ error: 'Failed to replace markers' }, { status: 500 })
  }
}
