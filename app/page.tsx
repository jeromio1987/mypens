import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** WP 1.3 — `/` is Read. Mode lives at `/mode`. */
export default async function Page() {
  const cookieStore = await cookies()
  const seenWelcome = cookieStore.get('mp_seen_welcome')?.value === '1'

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

  redirect('/period-review')
}
