'use client'

import { useState } from 'react'
import Link from 'next/link'
import GarminLog from '@/components/garmin/GarminLog'

function GarminHealthSync() {
  const [status, setStatus] = useState<Record<string, string>>({})

  async function sync(endpoint: string, label: string) {
    setStatus(s => ({ ...s, [label]: 'Syncing…' }))
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        const n = data.ingested ?? data.upserted ?? 0
        const skipped = data.skipped ?? 0
        setStatus(s => ({ ...s, [label]: `Done — ${n} ingested, ${skipped} skipped` }))
      } else {
        setStatus(s => ({ ...s, [label]: `Error: ${data.error ?? 'unknown'}` }))
      }
    } catch {
      setStatus(s => ({ ...s, [label]: 'Failed to reach server' }))
    }
  }

  return (
    <div className="bg-pens-surface rounded-2xl p-4 border border-pens-muted/30 space-y-3">
      <p className="text-xs uppercase tracking-widest text-pens-muted font-semibold">Health Sync</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => sync('/api/integrations/garmin/body-sync', 'body')}
          className="px-3 py-1.5 text-sm rounded-lg bg-pens-navy border border-pens-muted/30 text-pens-cream hover:border-pens-gold/50 transition"
        >
          Sync body weight (30 days)
        </button>
        <button
          onClick={() => sync('/api/integrations/garmin/sleep-sync', 'sleep')}
          className="px-3 py-1.5 text-sm rounded-lg bg-pens-navy border border-pens-muted/30 text-pens-cream hover:border-pens-gold/50 transition"
        >
          Sync sleep (30 days)
        </button>
        <button
          onClick={() => sync('/api/integrations/garmin/dailies-sync?days=30', 'dailies')}
          className="px-3 py-1.5 text-sm rounded-lg bg-pens-navy border border-pens-muted/30 text-pens-cream hover:border-pens-gold/50 transition"
        >
          Sync dailies (steps / Active kcal)
        </button>
      </div>
      {Object.entries(status).map(([k, v]) => (
        <p key={k} className="text-xs text-pens-cream/60">{k}: {v}</p>
      ))}
    </div>
  )
}

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

        <GarminHealthSync />

        <GarminLog year={year} sport={sport} />

      </div>
    </main>
  )
}
