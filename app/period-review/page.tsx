import DestinationsChrome from '@/components/shared/DestinationsChrome'
import PeriodCockpit from '@/components/period-review/PeriodCockpit'

export const dynamic = 'force-dynamic'

export default function PeriodReviewPage() {
  return (
    <DestinationsChrome active="read">
      <PeriodCockpit />
    </DestinationsChrome>
  )
}
