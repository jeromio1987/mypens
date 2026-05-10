import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const programmes = await prisma.programme.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        days: {
          orderBy: { order: 'asc' },
          include: {
            exercises: { orderBy: { order: 'asc' } },
          },
        },
      },
    })
    return NextResponse.json(programmes)
  } catch {
    return NextResponse.json({ error: 'Failed to list programmes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { name?: string } | null
    const name = body?.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const p = await prisma.programme.create({
      data: { name },
    })
    return NextResponse.json(p)
  } catch {
    return NextResponse.json({ error: 'Failed to create programme' }, { status: 500 })
  }
}
