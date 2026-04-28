import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import HomeClient from './HomeClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const cookieStore = await cookies()
  const seenWelcome = cookieStore.get('mp_seen_welcome')?.value === '1'

  // First-time visitors with no logged data get routed to /welcome.
  // Once they've seen /welcome (cookie is set by middleware) they stay on /.
  if (!seenWelcome) {
    const [dayCount, weightCount, sleepCount, measCount] = await Promise.all([
      prisma.dayEntry.count(),
      prisma.weightEntry.count(),
      prisma.sleepEntry.count(),
      prisma.bodyMeasurement.count(),
    ])
    if (dayCount === 0 && weightCount === 0 && sleepCount === 0 && measCount === 0) {
      redirect('/welcome')
    }
  }

  return <HomeClient />
}
