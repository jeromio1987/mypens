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
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Training</h1>
            <p className="text-sm text-gray-400">Sets · Reps · Volume</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/integrations"
              className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 hover:border-orange-300 rounded-lg px-2.5 py-2"
              title="Integrations & Strava sync"
            >
              Strava ↗
            </Link>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <TrainingEntry date={date} onSaved={() => setRefresh(r => r + 1)} />
        <TrainingLog date={date} refresh={refresh} />
      </div>
    </main>
  )
}
