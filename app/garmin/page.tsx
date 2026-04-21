'use client'

import { useState } from 'react'
import Link from 'next/link'
import GarminLog from '@/components/garmin/GarminLog'

const YEARS  = ['all', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019']
const SPORTS = [
  { value: 'all',               label: 'All sports' },
  { value: 'running',           label: '🏃 Running' },
  { value: 'cycling',           label: '🚴 Cycling' },
  { value: 'walking',           label: '🚶 Walking' },
  { value: 'swimming',          label: '🏊 Swimming' },
  { value: 'hiking',            label: '🥾 Hiking' },
  { value: 'strength_training', label: '🏋️ Strength' },
  { value: 'cardio_training',   label: '❤️ Cardio' },
]

export default function GarminPage() {
  const [year,  setYear]  = useState('all')
  const [sport, setSport] = useState('all')

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Garmin Activities</h1>
            <p className="text-sm text-gray-400">Imported from Garmin Connect · 2019 – 2026</p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y === 'all' ? 'All years' : y}</option>
              ))}
            </select>

            <select
              value={sport}
              onChange={e => setSport(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {SPORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <GarminLog year={year} sport={sport} />

      </div>
    </main>
  )
}
