'use client'

import { useState } from 'react'
import Link from 'next/link'
import WeightEntry from '@/components/weight/WeightEntry'
import WeightTrend from '@/components/weight/WeightTrend'
import BodyCompTrend from '@/components/weight/BodyCompTrend'
import TrueWeightBacktest from '@/components/weight/TrueWeightBacktest'
import EventBanner from '@/components/shared/EventBanner'

export default function WeightPage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Weight Tracker</h1>
            <p className="text-sm text-gray-400">Scale weight · Water retention · True weight v3</p>
          </div>
          <Link href="/events" className="text-xs text-sky-500 hover:underline">Events →</Link>
        </div>

        <EventBanner />

        <WeightEntry onSaved={() => setRefresh(r => r + 1)} />
        <WeightTrend refresh={refresh} />
        <BodyCompTrend refresh={refresh} />
        <TrueWeightBacktest />
      </div>
    </main>
  )
}
