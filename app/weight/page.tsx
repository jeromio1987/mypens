'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import WeightEntry from '@/components/weight/WeightEntry'
import WeightTrend from '@/components/weight/WeightTrend'
import BodyCompTrend from '@/components/weight/BodyCompTrend'
import TrueWeightBacktest from '@/components/weight/TrueWeightBacktest'
import EventBanner from '@/components/shared/EventBanner'

export default function WeightPage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Weight Tracker</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">Scale weight · Water retention · True weight v3</p>
            </div>
          </div>
          <Link href="/events" className="text-xs text-pens-gold hover:text-pens-cream transition-colors">
            Events →
          </Link>
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
