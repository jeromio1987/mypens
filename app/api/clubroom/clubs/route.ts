import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const memberships = await prisma.clubMember.findMany({
      where: { userId: 'default' },
      include: { club: true },
      orderBy: { joinedAt: 'asc' },
    })
    return NextResponse.json({ clubs: memberships.map(m => ({ ...m.club, displayName: m.displayName })) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, displayName } = await request.json()
    if (!name?.trim() || !displayName?.trim()) {
      return NextResponse.json({ error: 'name and displayName required' }, { status: 400 })
    }
    const club = await prisma.club.create({ data: { name: name.trim() } })
    await prisma.clubMember.create({
      data: { clubId: club.id, userId: 'default', displayName: displayName.trim() },
    })
    return NextResponse.json({ club, inviteCode: club.inviteCode })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
