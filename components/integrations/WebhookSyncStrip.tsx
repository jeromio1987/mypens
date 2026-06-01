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
  lastErrorAt?: string | null
  expiresAt?: number | null
  scope?: string | null
  athleteId?: string | null
  deviceLabel?: string | null
  hoursSinceLastIngest?: number | null
  stale?: boolean
  staleThresholdHours?: number
}

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'strava', label: 'Strava' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'healthkit', label: 'HealthKit' },
  { id: 'healthconnect', label: 'Health Connect' },
]

function shortScope(s: string | null | undefined, max = 36): string {
  if (!s) return '—'
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

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
              lastErrorAt: (data.lastErrorAt as string | null | undefined) ?? null,
              expiresAt: (data.expiresAt as number | null | undefined) ?? null,
              scope: (data.scope as string | null | undefined) ?? null,
              athleteId: (data.athleteId as string | null | undefined) ?? null,
              deviceLabel: (data.deviceLabel as string | null | undefined) ?? null,
              hoursSinceLastIngest: (data.hoursSinceLastIngest as number | null | undefined) ?? null,
              stale: data.stale as boolean | undefined,
              staleThresholdHours: data.staleThresholdHours as number | undefined,
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-pens-crimson">Sync health</p>
        <p className="text-[10px] text-pens-cream/35">
          OAuth sources: webhook + last sync. Pairing sources: last ingest + stale flag.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-pens-muted/20 bg-pens-deep/50 p-3 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-pens-cream">{r.label}</p>
              {r.stale ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  Stale
                </span>
              ) : null}
            </div>
            <p className="text-pens-cream/45">
              {r.configured === false
                ? 'Not configured'
                : r.connected
                  ? 'Connected'
                  : 'Disconnected'}
            </p>
            {r.webhookActive != null && r.id !== 'healthkit' && r.id !== 'healthconnect' && (
              <p className="text-pens-cream/40">Webhook: {r.webhookActive ? 'on' : 'off'}</p>
            )}
            {(r.id === 'strava' || r.id === 'garmin') && r.expiresAt != null && (
              <p className="text-pens-cream/35" title="OAuth access token expiry">
                Token exp: {new Date(r.expiresAt * 1000).toLocaleString()}
              </p>
            )}
            {r.scope && (r.id === 'strava' || r.id === 'garmin') && (
              <p className="text-pens-cream/30 truncate" title={r.scope ?? ''}>
                Scope: {shortScope(r.scope)}
              </p>
            )}
            {r.athleteId && (
              <p className="text-pens-cream/30 truncate" title={String(r.athleteId)}>
                Athlete / account id: {r.athleteId}
              </p>
            )}
            {r.deviceLabel && (
              <p className="text-pens-cream/30 truncate" title={r.deviceLabel}>
                Device: {r.deviceLabel}
              </p>
            )}
            {(r.id === 'healthkit' || r.id === 'healthconnect') && r.hoursSinceLastIngest != null && (
              <p className="text-pens-cream/35">
                Hours since ingest: {r.hoursSinceLastIngest.toFixed(1)}
                {r.staleThresholdHours != null ? ` (warn > ${r.staleThresholdHours}h)` : ''}
              </p>
            )}
            {(r.id === 'healthkit' || r.id === 'healthconnect') && r.lastIngestAt && (
              <p className="text-pens-cream/35 truncate" title={r.lastIngestAt}>
                Last ingest: {r.lastIngestAt}
              </p>
            )}
            {r.lastSyncAt && r.id !== 'healthkit' && r.id !== 'healthconnect' && (
              <p className="text-pens-cream/35 truncate" title={r.lastSyncAt}>
                Last sync: {r.lastSyncAt}
              </p>
            )}
            {r.lastErrorAt && (
              <p className="text-pens-cream/25 text-[10px] truncate" title={r.lastErrorAt}>
                Error at: {r.lastErrorAt}
              </p>
            )}
            {r.lastError && (
              <p className="text-amber-300/90 line-clamp-4" title={r.lastError}>
                {r.lastError}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
