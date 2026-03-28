'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import MeasurementsEntry from '@/components/measurements/MeasurementsEntry'
import MeasurementsTrend from '@/components/measurements/MeasurementsTrend'

export default function MeasurementsClient() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Body Measurements</h1>
            <p className="text-sm text-gray-400 mt-0.5">Waist, chest, hips and more</p>
          </div>
        </div>

        <MeasurementsEntry onSaved={() => setRefreshKey(k => k + 1)} />
        <MeasurementsTrend refreshKey={refreshKey} />
      </div>
    </main>
  )
}
