'use client'

import { useEffect, useState } from 'react'

type Diag = {
  pairing?: {
    connected?: boolean
    lastSyncAt?: string | null
    lastError?: string | null
  }
  sleep?: {
    nightsLogged?: number
    healthConnectNights?: number
    firstDate?: string | null
    lastDate?: string | null
  }
  window?: { from: string; to: string }
}

/** WP 0.2 — one-line sync health for web Sleep page. */
export default function SleepSyncStatus() {
  const [diag, setDiag] = useState<Diag | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/integrations/healthconnect/sleep-diagnostics')
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setError(typeof json?.error === 'string' ? json.error : 'Sync status unavailable')
          return
        }
        setDiag(json as Diag)
      } catch {
        if (!cancelled) setError('Sync status unavailable')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <p className="text-xs text-pens-cream/40 border border-pens-muted/20 rounded-lg px-3 py-2">
        Sync: {error}
      </p>
    )
  }
  if (!diag) {
    return (
      <p className="text-xs text-pens-cream/30 border border-pens-muted/20 rounded-lg px-3 py-2">
        Sync: loading…
      </p>
    )
  }

  const last = diag.pairing?.lastSyncAt
    ? new Date(diag.pairing.lastSyncAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'never'
  const nights = diag.sleep?.nightsLogged ?? 0
  const hc = diag.sleep?.healthConnectNights ?? 0
  const err = diag.pairing?.lastError

  return (
    <div className="text-xs border border-pens-muted/20 rounded-lg px-3 py-2 space-y-1">
      <p className="text-pens-cream/55">
        Sync · last success <span className="text-pens-cream/80">{last}</span>
        {' · '}
        <span className="text-pens-cream/80">{nights}</span> nights / 30d
        {' · '}
        <span className="text-pens-cream/80">{hc}</span> from Health Connect
      </p>
      {err ? <p className="text-amber-300/90">Last error: {err}</p> : null}
    </div>
  )
}
