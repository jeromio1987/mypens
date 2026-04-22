'use client'

import { useState } from 'react'
import Link from 'next/link'
import TrainingEntry from '@/components/training/TrainingEntry'
import TrainingLog from '@/components/training/TrainingLog'

export default function TrainingPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [refresh, setRefresh] = useState(0)

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-pens-cream/50 hover:text-pens-cream">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Training</h1>
            <p className="text-sm text-pens-cream/50">Sets · Reps · Volume</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/integrations"
              className="text-xs text-pens-gold hover:text-pens-cream border border-pens-gold/40 hover:border-pens-gold/70 rounded-lg px-2.5 py-2 transition-colors"
              title="Integrations & Strava sync"
            >
              Strava ↗
            </Link>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-pens-surface border border-pens-muted/40 text-pens-cream rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pens-gold focus:border-pens-gold [color-scheme:dark]"
            />
          </div>
        </div>

        <TrainingEntry date={date} onSaved={() => setRefresh(r => r + 1)} />
        <TrainingLog date={date} refresh={refresh} />
      </div>
    </main>
  )
}
