import { computeVerdictData } from '@/lib/verdictData'
import VerdictClient from './VerdictClient'

export const dynamic = 'force-dynamic'

export default async function VerdictPage() {
  let initialData = null
  let initialError: string | null = null
  try {
    initialData = await computeVerdictData()
  } catch (err) {
    console.error('[verdict page]', err)
    initialError = 'Could not compute the verdict.'
  }
  return <VerdictClient initialData={initialData} initialError={initialError} />
}
