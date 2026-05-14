'use client'

import { useEffect, useState } from 'react'

type ProviderId = 'strava' | 'garmin' | 'healthkit' | 'healthconnect'

interface Row {
  id: ProviderId
  label: string
  configured?: boolean
  connected?: boolean
  webhookActive?: boolean
  lastSyncAt?: string | null
  lastIngestAt?: string | null
  lastError?: string | null
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'strava', label: 'Strava' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'healthkit', label: 'HealthKit' },
  { id: 'healthconnect', label: 'Health Connect' },
]

export function WebhookSyncStrip() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Row[] = await Promise.all(
        PROVIDERS.map(async (p) => {
          try {
            const r = await fetch(`/api/integrations/${p.id}/status`)
            const data = r.ok ? ((await r.json()) as Record<string, unknown>) : {}
            return {
              id: p.id,
              label: p.label,
              configured: data.configured as boolean | undefined,
              connected: data.connected as boolean | undefined,
              webhookActive: data.webhookActive as boolean | undefined,
              lastSyncAt: (data.lastSyncAt as string | null | undefined) ?? null,
              lastIngestAt: (data.lastIngestAt as string | null | undefined) ?? null,
              lastError: (data.lastError as string | null | undefined) ?? null,
            }
          } catch {
            return { id: p.id, label: p.label, lastError: 'Could not load status' }
          }
        }),
      )
      if (!cancelled) setRows(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!rows) {
    return (
      <div className="rounded-2xl border border-pens-muted/20 bg-pens-surface/40 p-4 text-xs text-pens-cream/50">
        Loading webhook / sync status…
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-pens-muted/20 bg-pens-surface/60 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-pens-crimson">Sync health</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-pens-muted/20 bg-pens-deep/50 p-3 text-[11px]">
            <p className="font-medium text-pens-cream">{r.label}</p>
            <p className="text-pens-cream/45 mt-1">
              {r.configured === false
                ? 'Not configured'
                : r.connected
                  ? 'Connected'
                  : 'Disconnected'}
            </p>
            {r.webhookActive != null && r.id !== 'healthkit' && r.id !== 'healthconnect' && (
              <p className="text-pens-cream/40 mt-0.5">Webhook: {r.webhookActive ? 'on' : 'off'}</p>
            )}
            {(r.id === 'healthkit' || r.id === 'healthconnect') && r.lastIngestAt && (
              <p className="text-pens-cream/35 mt-0.5 truncate" title={r.lastIngestAt}>
                Last ingest: {r.lastIngestAt}
              </p>
            )}
            {r.lastSyncAt && r.id !== 'healthkit' && r.id !== 'healthconnect' && (
              <p className="text-pens-cream/35 mt-0.5 truncate" title={r.lastSyncAt}>
                Last sync: {r.lastSyncAt}
              </p>
            )}
            {r.lastError && (
              <p className="text-amber-300/90 mt-1 line-clamp-3" title={r.lastError}>
                {r.lastError}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
