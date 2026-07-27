/**
 * Latest blood panel soft summary for Read / Audit chips.
 * Educational context only — not diagnosis.
 */

import { prisma } from '@/lib/db'
import {
  flagMarkers,
  softBloodworkRead,
  type FlaggedMarker,
} from '@/lib/bloodworkFlags'
import { schildklierRead } from '@/lib/bloodworkThyroidRead'

export type BloodworkLatestSummary = {
  present: boolean
  panelId: string | null
  drawDate: string | null
  labName: string | null
  flaggedCount: number
  belowCount: number
  aboveCount: number
  chipLabel: string
  summary: string
  disclaimer: string
  thyroidPresent: boolean
  markers: FlaggedMarker[]
}

const EMPTY: BloodworkLatestSummary = {
  present: false,
  panelId: null,
  drawDate: null,
  labName: null,
  flaggedCount: 0,
  belowCount: 0,
  aboveCount: 0,
  chipLabel: 'No labs yet',
  summary: '',
  disclaimer:
    'Educational self-tracking only — not a diagnosis or medical advice. Discuss results with your clinician.',
  thyroidPresent: false,
  markers: [],
}

/** Soft chip + summary from the newest BloodworkPanel (by drawDate). */
export async function loadBloodworkLatestSummary(): Promise<BloodworkLatestSummary> {
  const panel = await prisma.bloodworkPanel.findFirst({
    orderBy: { drawDate: 'desc' },
    include: { markers: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!panel) return EMPTY

  const flagged = flagMarkers(
    panel.markers.map(m => ({
      code: m.code,
      label: m.label,
      valueNum: m.valueNum,
      refLow: m.refLow,
      refHigh: m.refHigh,
    })),
  )
  const soft = softBloodworkRead(flagged)
  const belowCount = soft.byFlag.below.length
  const aboveCount = soft.byFlag.above.length
  const flaggedCount = belowCount + aboveCount
  const thyroid = schildklierRead(
    panel.markers.map(m => ({
      code: m.code,
      label: m.label,
      valueNum: m.valueNum,
      refLow: m.refLow,
      refHigh: m.refHigh,
      unit: m.unit,
    })),
  )

  const chipLabel =
    flaggedCount > 0
      ? `${flaggedCount} flagged marker${flaggedCount === 1 ? '' : 's'} · see Labs`
      : `Labs · ${panel.drawDate}`

  return {
    present: true,
    panelId: panel.id,
    drawDate: panel.drawDate,
    labName: panel.labName,
    flaggedCount,
    belowCount,
    aboveCount,
    chipLabel,
    summary: soft.summary,
    disclaimer: soft.disclaimer,
    thyroidPresent: thyroid.present,
    markers: flagged,
  }
}
