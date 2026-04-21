'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface ProviderStatus {
  id: string
  name: string
  endpoint: string
}

const PROVIDERS: ProviderStatus[] = [
  { id: 'strava',        name: 'Strava',         endpoint: '/api/integrations/strava/status' },
  { id: 'garmin',        name: 'Garmin',         endpoint: '/api/integrations/garmin/status' },
  { id: 'healthkit',     name: 'HealthKit',      endpoint: '/api/integrations/healthkit/status' },
  { id: 'healthconnect', name: 'Health Connect', endpoint: '/api/integrations/healthconnect/status' },
]

interface FailingProvider {
  name: string
  lastError: string
  lastErrorAt: string | null
}

export default function SyncStatusBadge() {
  const [failing, setFailing] = useState<FailingProvider[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      PROVIDERS.map(p =>
        fetch(p.endpoint)
          .then(r => (r.ok ? r.json() : null))
          .then(d => (d && d.connected && d.lastError
            ? { name: p.name, lastError: String(d.lastError), lastErrorAt: d.lastErrorAt ?? null }
            : null))
          .catch(() => null),
      ),
    ).then(results => {
      if (cancelled) return
      setFailing(results.filter((r): r is FailingProvider => r !== null))
    })
    return () => { cancelled = true }
  }, [])

  if (failing.length === 0) return null

  const primary = failing[0]
  const more = failing.length - 1
  const label = failing.length === 1
    ? `${primary.name} sync failed`
    : `${primary.name} sync failed (+${more})`

  return (
    <Link
      href="/integrations"
      title={failing.map(f => `${f.name}: ${f.lastError}`).join('\n')}
      className="flex items-center gap-2 w-full bg-pens-crimson/15 border border-pens-crimson/40 rounded-xl px-3 py-2 text-pens-cream hover:bg-pens-crimson/25 transition-colors"
    >
      <AlertTriangle size={14} className="text-pens-crimson shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-widest text-pens-crimson/80 font-semibold leading-none mb-0.5">
          Integration issue
        </p>
        <p className="text-xs font-semibold text-pens-cream truncate">{label}</p>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-pens-cream/50 shrink-0">Fix ↗</span>
    </Link>
  )
}
