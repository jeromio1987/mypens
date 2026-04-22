import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/notifications
 *
 * Returns the current user's in-app notifications, newest first. By default
 * only unread (`readAt` null) — pass `?all=1` to include read items too.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeRead = url.searchParams.get('all') === '1'
    const items = await prisma.notification.findMany({
      where: {
        userId: 'default',
        ...(includeRead ? {} : { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ items })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to load notifications' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/notifications
 *
 * Body: { ids?: string[], all?: true }
 *
 * Marks the listed notifications (or all unread, if `all: true`) as read.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined
    const all: boolean = body?.all === true
    const now = new Date()

    if (!ids?.length && !all) {
      return NextResponse.json(
        { error: 'ids[] or all:true required' },
        { status: 400 },
      )
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: 'default',
        readAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: now },
    })

    return NextResponse.json({ ok: true, updated: result.count })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 },
    )
  }
}
