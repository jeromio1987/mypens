import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { inviteCode, displayName } = await request.json()
    if (!inviteCode?.trim() || !displayName?.trim()) {
      return NextResponse.json({ error: 'inviteCode and displayName required' }, { status: 400 })
    }
    const club = await prisma.club.findUnique({ where: { inviteCode: inviteCode.trim() } })
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }
    const existing = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: club.id, userId: 'default' } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 })
    }
    const member = await prisma.clubMember.create({
      data: { clubId: club.id, userId: 'default', displayName: displayName.trim() },
    })
    return NextResponse.json({ ok: true, club: { id: club.id, name: club.name }, member })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
