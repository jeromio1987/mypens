import { computeDashboardData } from '@/lib/dashboardData'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let initialData = null
  let initialError: string | null = null
  try {
    initialData = await computeDashboardData()
  } catch (err) {
    console.error('[dashboard page]', err)
    initialError = 'Could not load the dashboard.'
  }
  return <DashboardClient initialData={initialData} initialError={initialError} />
}
