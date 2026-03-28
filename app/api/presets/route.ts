import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/presets?module=food  → list presets for a module
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const module = searchParams.get('module')

    const presets = await prisma.preset.findMany({
      where: module ? { module } : undefined,
      orderBy: [{ usedCount: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(presets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

// POST /api/presets  { module, name, data }
export async function POST(request: Request) {
  try {
    const { module, name, data } = await request.json()
    if (!module || !name || !data) {
      return NextResponse.json({ error: 'module, name and data are required' }, { status: 400 })
    }

    const preset = await prisma.preset.create({
      data: {
        module,
        name,
        data: typeof data === 'string' ? data : JSON.stringify(data),
      },
    })
    return NextResponse.json(preset)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

// PATCH /api/presets  { id }  → increment usedCount
export async function PATCH(request: Request) {
  try {
    const { id } = await request.json()
    const preset = await prisma.preset.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    })
    return NextResponse.json(preset)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// DELETE /api/presets  { id }
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await prisma.preset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
