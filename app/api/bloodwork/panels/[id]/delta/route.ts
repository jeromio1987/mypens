import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { comparePanelMarkers } from '@/lib/bloodworkPanelDelta'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Compare this panel vs the chronologically previous draw (shared marker codes). */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const panel = await prisma.bloodworkPanel.findUnique({
      where: { id },
      include: { markers: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!panel) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const previous = await prisma.bloodworkPanel.findFirst({
      where: {
        OR: [
          { drawDate: { lt: panel.drawDate } },
          { drawDate: panel.drawDate, createdAt: { lt: panel.createdAt } },
        ],
        NOT: { id: panel.id },
      },
      orderBy: [{ drawDate: 'desc' }, { createdAt: 'desc' }],
      include: { markers: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!previous) {
      return NextResponse.json({
        present: false,
        previousPanelId: null,
        previousDrawDate: null,
        sharedCount: 0,
        deltas: [],
        summaryLine: '',
        disclaimer:
          'Panel-to-panel deltas are self-tracking context only — not a diagnosis or medical trend.',
      })
    }

    const result = comparePanelMarkers(panel.markers, previous.markers)
    return NextResponse.json({
      ...result,
      previousPanelId: previous.id,
      previousDrawDate: previous.drawDate,
      latestDrawDate: panel.drawDate,
    })
  } catch (err) {
    console.error('[bloodwork/delta]', err)
    return NextResponse.json({ error: 'Failed to compare panels' }, { status: 500 })
  }
}
