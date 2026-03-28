import { Metadata } from 'next'
import DataHealthClient from './DataHealthClient'

export const metadata: Metadata = { title: 'Data Health — MY PENS' }

export default function DataHealthPage() {
  return <DataHealthClient />
}
