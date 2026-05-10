import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; dayId: string }>
  },
) {
  try {
    const { id, dayId } = await params
    await prisma.programmeDay.deleteMany({
      where: { id: dayId, programmeId: id },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete day' }, { status: 500 })
  }
}
