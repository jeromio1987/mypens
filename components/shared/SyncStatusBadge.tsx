'use client'

/**
 * WP 1.4 — Sync chip: last success per source + fail; tap → Audit (/verdict?sync=1).
 * WP 3.3 — Continental surfaces (0 radius).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Cable } from 'lucide-react'
import { buildSyncChipState, type SyncSourceStatus } from '@/lib/syncChip'

type StatusPayload = {
  connected?: boolean
  lastSyncAt?: string | null
  lastSuccessAt?: string | null
  lastError?: string | null
  lastErrorAt?: string | null
}

const ENDPOINTS: { id: SyncSourceStatus['id']; label: string; endpoint: string }[] = [
  { id: 'garmin', label: 'Garmin', endpoint: '/api/integrations/garmin/status' },
  { id: 'healthconnect_sleep', label: 'HC sleep', endpoint: '/api/integrations/healthconnect/status' },
  { id: 'healthconnect_workouts', label: 'HC workouts', endpoint: '/api/integrations/healthconnect/status' },
]

function pickSuccess(d: StatusPayload | null): string | null {
  if (!d) return null
  return d.lastSuccessAt ?? d.lastSyncAt ?? null
}

export default function SyncStatusBadge() {
  const [sources, setSources] = useState<SyncSourceStatus[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      ENDPOINTS.map(async p => {
        try {
          const r = await fetch(p.endpoint)
          const d = r.ok ? ((await r.json()) as StatusPayload) : null
          return {
            id: p.id,
            label: p.label,
            connected: Boolean(d?.connected),
            lastSuccessAt: pickSuccess(d),
            lastError: d?.lastError ? String(d.lastError) : null,
            lastErrorAt: d?.lastErrorAt ?? null,
          } satisfies SyncSourceStatus
        } catch {
          return {
            id: p.id,
            label: p.label,
            connected: false,
            lastSuccessAt: null,
            lastError: null,
            lastErrorAt: null,
          } satisfies SyncSourceStatus
        }
      }),
    ).then(rows => {
      if (!cancelled) setSources(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (sources.length === 0) return null

  const state = buildSyncChipState(sources)
  const href = '/verdict?sync=1'

  if (state.primaryError) {
    return (
      <Link
        href={href}
        title={state.sources
          .filter(s => s.lastError)
          .map(s => `${s.label}: ${s.lastError}`)
          .join('\n')}
        className="flex items-center gap-3 w-full bg-ct-bloodc px-4 py-3 text-ct-blood hover:opacity-95 transition-opacity"
      >
        <AlertTriangle size={14} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-blood/80 leading-none mb-1">
            Sync issue
          </p>
          <p className="text-xs font-semibold text-ct-primary truncate">
            {state.primaryError.label}: {state.primaryError.message}
          </p>
        </div>
        <span className="font-grotesk text-[0.5625rem] uppercase tracking-[0.16em] text-ct-blood/60 shrink-0">
          Audit ↗
        </span>
      </Link>
    )
  }

  const when = state.lastAnySuccessAt
    ? new Date(state.lastAnySuccessAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Link
      href={href}
      className="flex items-center gap-3 w-full bg-ct-high px-4 py-3 text-ct-second/70 hover:bg-ct-highest transition-colors"
    >
      {when ? (
        <CheckCircle2 size={14} className="text-ct-primary shrink-0 opacity-80" />
      ) : (
        <Cable size={14} className="text-ct-second/40 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.18em] text-ct-second/45 leading-none mb-1">
          Sync
        </p>
        <p className="text-xs font-semibold text-ct-primary truncate">
          {when ? `Last OK ${when}` : 'No recent sync timestamps'}
        </p>
      </div>
      <span className="font-grotesk text-[0.5625rem] uppercase tracking-[0.16em] text-ct-second/40 shrink-0">
        Audit
      </span>
    </Link>
  )
}
