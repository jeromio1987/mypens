import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function programmeWithRelations(id: string) {
  return prisma.programme.findUnique({
    where: { id },
    include: {
      days: {
        orderBy: { order: 'asc' },
        include: { exercises: { orderBy: { order: 'asc' } } },
      },
    },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as {
      name?: string
      active?: boolean
    } | null
    if (!body || (body.name === undefined && body.active === undefined)) {
      const row = await programmeWithRelations(id)
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(row)
    }

    if (body.active === true) {
      await prisma.$transaction([
        prisma.programme.updateMany({ data: { active: false } }),
        prisma.programme.update({
          where: { id },
          data: {
            ...(typeof body.name === 'string' && body.name.trim()
              ? { name: body.name.trim() }
              : {}),
            active: true,
          },
        }),
      ])
    } else {
      const data: { name?: string; active?: boolean } = {}
      if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
      if (body.active === false) data.active = false
      if (Object.keys(data).length > 0) {
        await prisma.programme.update({ where: { id }, data })
      }
    }

    const row = await programmeWithRelations(id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: 'Failed to update programme' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.programme.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete programme' }, { status: 500 })
  }
}
