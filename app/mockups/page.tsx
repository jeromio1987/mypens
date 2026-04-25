import mockups from '@/lib/stitchMockups.json'
import MockupsClient from './MockupsClient'

type Mockup = { slug: string; title: string }
type Manifest = Record<string, Mockup[]>

export const metadata = { title: 'MY PENS — Mockup Reference' }

export default function MockupsPage() {
  return <MockupsClient manifest={mockups as Manifest} />
}
