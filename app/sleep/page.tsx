'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SleepEntry from '@/components/sleep/SleepEntry'
import SleepTrend from '@/components/sleep/SleepTrend'
import SleepDebt, { type SleepEntryRow } from '@/components/sleep/SleepDebt'
import SleepSyncStatus from '@/components/sleep/SleepSyncStatus'
import { today } from '@/lib/timeWindow'

export default function SleepPage() {
  const [date, setDate] = useState(() => today())
  const [refresh, setRefresh] = useState(0)
  const [sleepEntries, setSleepEntries] = useState<SleepEntryRow[]>([])
  const [sleepLoading, setSleepLoading] = useState(true)

  const loadSleepEntries = useCallback(async () => {
    setSleepLoading(true)
    try {
      const res = await fetch('/api/sleep')
      const data = await res.json()
      setSleepEntries(Array.isArray(data) ? data : [])
    } catch {
      setSleepEntries([])
    } finally {
      setSleepLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSleepEntries()
  }, [refresh, loadSleepEntries])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors shrink-0">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
              <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Sleep</h1>
              <p className="text-xs text-pens-cream/40 mt-0.5">Hours · Quality · HRV</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/integrations"
              className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 border border-indigo-400/40 hover:border-indigo-300/70 rounded-lg px-2.5 py-2 transition-colors"
              title="Health Connect, Garmin, Strava"
            >
              Integrations
            </Link>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-pens-navy border border-pens-muted/40 rounded-lg px-3 py-2 text-sm text-pens-cream focus:outline-none focus:border-pens-cream/30"
            />
          </div>
        </div>

        <p className="text-xs text-pens-cream/45 leading-relaxed rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-3 py-2">
          Auto-sync sleep from Garmin via Health Connect: open{' '}
          <Link href="/integrations" className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200">
            Integrations
          </Link>
          , pair the Android token, then tap <span className="text-pens-cream/70">Sync now</span> in the phone app.
        </p>

        <SleepSyncStatus />

        <SleepEntry date={date} onSaved={() => setRefresh(r => r + 1)} />
        <SleepTrend
          entries={sleepEntries}
          loading={sleepLoading}
          onSleepDataMutate={loadSleepEntries}
        />
        <SleepDebt entries={sleepEntries} />
      </div>
    </main>
  )
}
