'use client'

import { useState } from 'react'
import Link from 'next/link'
import GarminLog from '@/components/garmin/GarminLog'

const YEARS = ['all', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019']
const SPORTS = [
  { value: 'all',               label: 'All sports' },
  { value: 'running',           label: 'Running' },
  { value: 'cycling',           label: 'Cycling' },
  { value: 'walking',           label: 'Walking' },
  { value: 'swimming',          label: 'Swimming' },
  { value: 'hiking',            label: 'Hiking' },
  { value: 'strength_training', label: 'Strength' },
  { value: 'cardio_training',   label: 'Cardio' },
]

export default function GarminPage() {
  const [year, setYear] = useState('all')
  const [sport, setSport] = useState('all')

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8 text-pens-cream">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/" className="text-xs uppercase tracking-widest text-pens-cream/40 hover:text-pens-cream/70">
              ← MY PENS
            </Link>
            <h1 className="text-2xl font-semibold mt-0.5">Garmin Activities</h1>
            <p className="text-sm text-pens-cream/50">Historical archive imported from Garmin Connect · 2019 – 2026</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border border-pens-muted/40 rounded-lg px-3 py-2 text-sm bg-pens-surface text-pens-cream focus:outline-none focus:border-pens-gold"
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y === 'all' ? 'All years' : y}</option>
              ))}
            </select>

            <select
              value={sport}
              onChange={e => setSport(e.target.value)}
              className="border border-pens-muted/40 rounded-lg px-3 py-2 text-sm bg-pens-surface text-pens-cream focus:outline-none focus:border-pens-gold"
            >
              {SPORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <Link href="/integrations" className="px-3 py-1.5 rounded-full bg-pens-surface/50 border border-pens-muted/30 text-pens-cream/70 hover:text-pens-cream">
            Live sync (Strava/Garmin/Health) →
          </Link>
          <Link href="/data" className="px-3 py-1.5 rounded-full bg-pens-surface/50 border border-pens-muted/30 text-pens-cream/70 hover:text-pens-cream">
            CSV import/export →
          </Link>
        </div>

        <GarminLog year={year} sport={sport} />

      </div>
    </main>
  )
}
