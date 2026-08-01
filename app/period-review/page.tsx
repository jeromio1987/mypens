import DestinationsChrome from '@/components/shared/DestinationsChrome'
import PeriodCockpit from '@/components/period-review/PeriodCockpit'
import { buildCockpitWindow } from '@/lib/engines/cockpitData'
import { shiftDateStr, toDateStr } from '@/lib/weekDates'

export const dynamic = 'force-dynamic'

/**
 * SSR the default 90d cockpit — same Verdict trap fix: client-only fetch +
 * remount/HMR must not leave "Loading window…" forever. Zoom still refetches.
 */
export default async function PeriodReviewPage() {
  const todayStr = toDateStr(new Date())
  const from = shiftDateStr(todayStr, -89)
  const to = todayStr

  let initialCockpit: Awaited<ReturnType<typeof buildCockpitWindow>> | null = null
  let initialError: string | null = null
  try {
    initialCockpit = await buildCockpitWindow({ from, to, asOf: to })
  } catch (err) {
    console.error('[period-review page]', err)
    initialError = 'Could not load cockpit window.'
  }

  return (
    <DestinationsChrome active="read">
      <PeriodCockpit
        initialFrom={from}
        initialTo={to}
        initialCockpit={initialCockpit}
        initialError={initialError}
      />
    </DestinationsChrome>
  )
}
