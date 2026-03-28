'use client'

import { useState } from 'react'
import Link from 'next/link'
import SleepEntry from '@/components/sleep/SleepEntry'
import SleepTrend from '@/components/sleep/SleepTrend'

export default function SleepPage() {
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
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Sleep</h1>
            <p className="text-sm text-gray-400">Hours · Quality · HRV</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <SleepEntry date={date} onSaved={() => setRefresh(r => r + 1)} />
        <SleepTrend refresh={refresh} />
      </div>
    </main>
  )
}
