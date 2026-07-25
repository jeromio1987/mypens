'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { WebhookSyncStrip } from '@/components/integrations/WebhookSyncStrip'

type ProviderId = 'strava' | 'garmin' | 'healthkit' | 'healthconnect'

interface ProviderConfig {
  id: ProviderId
  name: string
  initial: string
  color: string             // tailwind bg color for badge
  description: string
  /** OAuth-based providers redirect to /authorize. Pairing-token providers POST /connect. */
  authMode: 'oauth' | 'pairing'
  /** Activity verb shown on the action button when connected */
  syncLabel: string
  /** Optional env vars required for configured=true (only for OAuth providers) */
  envHint?: string
  /** Optional view label for external link in draft list */
  externalLinkLabel?: string
  /** Pairing instructions shown after token issued */
  pairingInstructions?: string
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'strava',
    name: 'Strava',
    initial: 'S',
    color: 'bg-orange-500',
    description: 'Pull your last 30 days of activities into the Training log.',
    authMode: 'oauth',
    syncLabel: 'Sync now',
    envHint: 'STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET',
    externalLinkLabel: 'View on Strava ↗',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    initial: 'G',
    color: 'bg-sky-600',
    description: 'Auto-upload workouts, sleep, and weight from Garmin Connect (push webhook + daily cron).',
    authMode: 'oauth',
    syncLabel: 'Sync now',
    envHint: 'GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_WEBHOOK_VERIFY_TOKEN',
    externalLinkLabel: 'View on Garmin ↗',
  },
  {
    id: 'healthkit',
    name: 'Apple Health',
    initial: '',
    color: 'bg-rose-500',
    description:
      'Generate a pairing token and use it from the iOS companion app to push HealthKit workouts here for review.',
    authMode: 'pairing',
    syncLabel: 'Refresh',
    pairingInstructions:
      'Paste this token into the iOS companion app. The app will POST workouts to /api/integrations/healthkit/ingest with this Bearer token.',
  },
  {
    id: 'healthconnect',
    name: 'Health Connect',
    initial: 'A',
    color: 'bg-emerald-600',
    description:
      'Generate a pairing token and use it from the Android companion app to push Health Connect sessions here for review.',
    authMode: 'pairing',
    syncLabel: 'Refresh',
    pairingInstructions:
      'Paste this token into the Android companion app. The app will POST sessions to /api/integrations/healthconnect/ingest with this Bearer token.',
  },
]

interface Status {
  configured: boolean
  connected: boolean
  athleteId?: string | null
  scope?: string | null
  deviceLabel?: string | null
  pendingCount?: number
  lastSyncAt: string | null
  /** Pairing providers only: last successful background ingest time. */
  lastIngestAt?: string | null
  /** Pairing providers only: hours since `lastIngestAt`, or null if never. */
  hoursSinceLastIngest?: number | null
  /** Pairing providers only: configurable threshold for the stale warning. */
  staleThresholdHours?: number
  /** Pairing providers only: true when `hoursSinceLastIngest` exceeds threshold. */
  stale?: boolean
  expiresAt?: number | null
  webhookActive?: boolean
  lastError?: string | null
  lastErrorAt?: string | null
}

/** Format an "X hours ago" / "X days ago" gap for the companion badge. */
function formatGap(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60))
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  if (hours < 24) {
    const h = Math.round(hours)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.round(hours / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

interface Draft {
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe: number | null
  notes: string
  volume: number
  source: ProviderId
  externalId: string
  externalUrl: string
  externalRaw: string
  alreadyImported: boolean
}

interface Banner {
  kind: 'ok' | 'err'
  msg: string
}

interface SkippedItem {
  externalId: string
  skippedAt: string
  date: string | null
  exercise: string | null
  notes: string | null
  source: ProviderId
}

function ProviderCard({ provider, banner }: { provider: ProviderConfig; banner: Banner | null }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, { exercise?: string; notes?: string }>>({})
  const [importing, setImporting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [issuingToken, setIssuingToken] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)
  const [skipped, setSkipped] = useState<SkippedItem[]>([])
  const [loadingSkipped, setLoadingSkipped] = useState(false)
  const [skippedError, setSkippedError] = useState<string | null>(null)
  const [unskipping, setUnskipping] = useState<Set<string>>(new Set())
  const [skippedSelected, setSkippedSelected] = useState<Set<string>>(new Set())

  const base = `/api/integrations/${provider.id}`

  const loadStatus = useCallback(() => {
    setLoadingStatus(true)
    fetch(`${base}/status`)
      .then(r => r.json())
      .then(setStatus)
      .finally(() => setLoadingStatus(false))
  }, [base])

  const loadActivities = useCallback(async () => {
    setLoadingActivities(true)
    setActivitiesError(null)
    setDrafts([])
    setSelected(new Set())
    try {
      const res = await fetch(`${base}/activities`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      const items: Draft[] = data.items ?? []
      setDrafts(items)
      setSelected(new Set(items.filter(i => !i.alreadyImported).map(i => i.externalId)))
    } catch (err) {
      setActivitiesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoadingActivities(false)
    }
  }, [base])

  const loadSkipped = useCallback(async () => {
    setLoadingSkipped(true)
    setSkippedError(null)
    try {
      const res = await fetch(`${base}/activities?showSkipped=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSkipped(data.skipped ?? [])
      setSkippedSelected(new Set())
    } catch (err) {
      setSkippedError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoadingSkipped(false)
    }
  }, [base])

  const unskipMany = async (ids: string[]) => {
    if (ids.length === 0) return
    setUnskipping(prev => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    try {
      const res = await fetch(`${base}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Un-skip failed')
      const removed = new Set(ids)
      setSkipped(prev => prev.filter(s => !removed.has(s.externalId)))
      setSkippedSelected(prev => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
      setFlash(
        ids.length === 1
          ? `Un-skipped — the next companion sync will re-ingest it`
          : `Un-skipped ${ids.length} — the next companion sync will re-ingest them`,
      )
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Un-skip failed')
    } finally {
      setUnskipping(prev => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }

  const unskipOne = (externalId: string) => unskipMany([externalId])

  const toggleSkipped = (id: string) => {
    setSkippedSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSkippedAll = () => {
    setSkippedSelected(prev =>
      prev.size === skipped.length ? new Set() : new Set(skipped.map(s => s.externalId)),
    )
  }

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => {
    if (status?.connected) loadActivities()
  }, [status?.connected, loadActivities])
  useEffect(() => {
    if (status?.connected && showSkipped) loadSkipped()
  }, [status?.connected, showSkipped, loadSkipped])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const setEdit = (id: string, key: 'exercise' | 'notes', value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  const importSelected = async () => {
    const items = drafts
      .filter(d => selected.has(d.externalId) && !d.alreadyImported)
      .map(d => {
        const e = edits[d.externalId]
        return {
          ...d,
          exercise: e?.exercise ?? d.exercise,
          notes: e?.notes ?? d.notes,
        }
      })
    if (items.length === 0) return
    setImporting(true)
    setFlash(null)
    try {
      const res = await fetch(`${base}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setFlash(`Imported ${data.created} · skipped ${data.skipped}`)
      loadStatus()
      loadActivities()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const skipDraft = async (externalId: string) => {
    setFlash(null)
    try {
      const res = await fetch(`${base}/activities?id=${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Skip failed')
      setDrafts(prev => prev.filter(d => d.externalId !== externalId))
      setSelected(prev => {
        const next = new Set(prev)
        next.delete(externalId)
        return next
      })
      setEdits(prev => {
        const next = { ...prev }
        delete next[externalId]
        return next
      })
      loadStatus()
      if (showSkipped) loadSkipped()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Skip failed')
    }
  }

  const clearUnselected = async () => {
    const targets = drafts.filter(d => !selected.has(d.externalId) && !d.alreadyImported)
    if (targets.length === 0) return
    if (!confirm(`Discard ${targets.length} unselected workout${targets.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setFlash(null)
    try {
      const res = await fetch(`${base}/activities`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: targets.map(t => t.externalId) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Clear failed')
      const removed = new Set(targets.map(t => t.externalId))
      setDrafts(prev => prev.filter(d => !removed.has(d.externalId)))
      setEdits(prev => {
        const next = { ...prev }
        for (const id of removed) delete next[id]
        return next
      })
      setFlash(`Cleared ${data.deleted ?? targets.length}`)
      loadStatus()
      if (showSkipped) loadSkipped()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Clear failed')
    }
  }

  const disconnect = async () => {
    if (!confirm(`Disconnect ${provider.name}? Imported entries will remain but lose the live link.`)) return
    await fetch(`${base}/disconnect`, { method: 'POST' })
    setDrafts([])
    setSelected(new Set())
    setPairingToken(null)
    loadStatus()
  }

  const issuePairing = async () => {
    setIssuingToken(true)
    try {
      const res = await fetch(`${base}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setPairingToken(data.pairingToken)
      loadStatus()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Failed to issue token')
    } finally {
      setIssuingToken(false)
    }
  }

  const accentBtn =
    provider.id === 'strava' ? 'bg-orange-500 hover:bg-orange-600'
    : provider.id === 'garmin' ? 'bg-sky-600 hover:bg-sky-700'
    : provider.id === 'healthkit' ? 'bg-rose-500 hover:bg-rose-600'
    : 'bg-emerald-600 hover:bg-emerald-700'

  return (
    <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-6 space-y-4">
      {banner && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            banner.kind === 'ok'
              ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300'
              : 'bg-pens-crimson/15 border-pens-crimson/40 text-red-300'
          }`}
        >
          {banner.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-xs font-bold ${provider.color}`}>
              {provider.initial}
            </span>
            <h2 className="text-lg font-semibold text-pens-cream">{provider.name}</h2>
          </div>
          <p className="text-sm text-pens-cream/50 mt-1">{provider.description}</p>
        </div>
        <div className="text-right text-xs text-pens-cream/50">
          {loadingStatus ? (
            'Loading…'
          ) : !status?.configured ? (
            <span className="text-amber-400">Not configured</span>
          ) : status.connected ? (
            <>
              <div className="text-emerald-400 font-medium">Connected</div>
              {status.athleteId && <div>Athlete #{status.athleteId}</div>}
              {status.deviceLabel && <div>{status.deviceLabel}</div>}
              {typeof status.pendingCount === 'number' && (
                <div>{status.pendingCount} pending</div>
              )}
              {provider.id === 'strava' && (
                <div className={status.webhookActive ? 'text-emerald-400' : 'text-pens-cream/40'}>
                  Webhook: {status.webhookActive ? 'active' : 'inactive'}
                </div>
              )}
              {status.lastSyncAt && (
                <div>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</div>
              )}
              {provider.authMode === 'pairing' && (
                <div className={status.stale ? 'text-amber-400 font-medium' : ''}>
                  Phone:{' '}
                  {status.hoursSinceLastIngest == null
                    ? 'never checked in'
                    : `last heard ${formatGap(status.hoursSinceLastIngest)}`}
                </div>
              )}
            </>
          ) : (
            'Not connected'
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status?.connected ? (
          <>
            <button
              onClick={loadActivities}
              disabled={loadingActivities}
              className={`text-sm px-4 py-2 rounded-lg disabled:opacity-50 text-white font-medium ${accentBtn}`}
            >
              {loadingActivities ? 'Syncing…' : provider.syncLabel}
            </button>
            {provider.authMode === 'pairing' && (
              <button
                onClick={issuePairing}
                disabled={issuingToken}
                className="text-sm px-4 py-2 rounded-lg border border-pens-muted/30 hover:bg-pens-navy/40 text-pens-cream/70"
              >
                {issuingToken ? 'Rotating…' : 'Rotate token'}
              </button>
            )}
            <button
              onClick={disconnect}
              className="text-sm px-4 py-2 rounded-lg border border-pens-muted/30 hover:bg-pens-navy/40 text-pens-cream/70"
            >
              Disconnect
            </button>
          </>
        ) : provider.authMode === 'oauth' ? (
          <a
            href={`${base}/authorize`}
            className={`text-sm px-4 py-2 rounded-lg font-medium text-white ${
              status?.configured ? accentBtn : 'bg-pens-muted/40 pointer-events-none'
            }`}
          >
            Connect {provider.name}
          </a>
        ) : (
          <button
            onClick={issuePairing}
            disabled={issuingToken}
            className={`text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${accentBtn}`}
          >
            {issuingToken ? 'Generating…' : `Pair ${provider.name}`}
          </button>
        )}
      </div>

      {status?.connected && provider.authMode === 'pairing' && status.stale && (
        <div className="text-xs bg-amber-900/20 border border-amber-500/30 text-amber-200 rounded-lg px-3 py-2">
          <span className="font-medium">
            Your {provider.name === 'Apple Health' ? 'iPhone' : 'phone'} hasn&apos;t checked in
            {status.hoursSinceLastIngest != null
              ? ` for ${formatGap(status.hoursSinceLastIngest).replace(' ago', '')}`
              : ' yet'}
            .
          </span>{' '}
          Open the companion app to re-grant background access.
          {typeof status.staleThresholdHours === 'number' && (
            <span className="text-amber-400">
              {' '}· threshold {status.staleThresholdHours}h
            </span>
          )}
        </div>
      )}

      {status?.connected && status.lastError && (
        <div className="text-xs bg-pens-crimson/15 border border-pens-crimson/40 text-red-300 rounded-lg px-3 py-2">
          <span className="font-medium">Last sync error:</span> {status.lastError}
          {status.lastErrorAt && (
            <span className="text-red-400"> · {new Date(status.lastErrorAt).toLocaleString()}</span>
          )}
        </div>
      )}

      {!status?.configured && !loadingStatus && provider.authMode === 'oauth' && (
        <p className="text-xs text-amber-200 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
          Set <code className="bg-pens-navy/60 px-1 rounded">{provider.envHint}</code> environment variables to enable {provider.name}.
        </p>
      )}

      {pairingToken && (
        <div className="text-xs bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
          <div className="font-medium text-amber-200">Pairing token (save this now — shown once)</div>
          <code className="block break-all bg-pens-deep/80 border border-amber-500/20 rounded px-2 py-1 text-amber-100">
            {pairingToken}
          </code>
          {provider.pairingInstructions && (
            <p className="text-amber-300/80">{provider.pairingInstructions}</p>
          )}
        </div>
      )}

      {status?.connected && (
        <div className="space-y-3 pt-2 border-t border-pens-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-pens-cream">Review pending activities</h3>
            <span className="text-xs text-pens-cream/40">
              {drafts.length} found · {drafts.filter(d => !d.alreadyImported).length} new
            </span>
          </div>

          {activitiesError && (
            <div className="text-sm bg-pens-crimson/15 border border-pens-crimson/40 text-red-300 rounded-lg px-3 py-2">
              {activitiesError}
            </div>
          )}

          {flash && (
            <div className="text-sm bg-emerald-900/20 border border-emerald-500/30 text-emerald-300 rounded-lg px-3 py-2">
              {flash}
            </div>
          )}

          {loadingActivities ? (
            <p className="text-sm text-pens-cream/40">Loading activities…</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-pens-cream/40">
              {provider.authMode === 'pairing'
                ? 'No workouts pushed yet from the companion app.'
                : 'No activities found in the recent window.'}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-pens-muted/10">
                {drafts.map(d => {
                  const editedExercise = edits[d.externalId]?.exercise ?? d.exercise
                  const editedNotes = edits[d.externalId]?.notes ?? d.notes
                  const isSelected = selected.has(d.externalId)
                  return (
                    <li key={d.externalId} className="py-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={d.alreadyImported}
                        onChange={() => toggle(d.externalId)}
                        className="mt-1.5 accent-pens-crimson"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-pens-cream/50 tabular-nums">{d.date}</span>
                          {d.alreadyImported && (
                            <span className="text-[10px] uppercase tracking-wide text-pens-cream/50 bg-pens-navy/60 rounded px-1.5 py-0.5">
                              Already imported
                            </span>
                          )}
                          {d.externalUrl && provider.externalLinkLabel && (
                            <a
                              href={d.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-pens-cream/50 hover:text-pens-cream"
                            >
                              {provider.externalLinkLabel}
                            </a>
                          )}
                        </div>
                        <input
                          value={editedExercise}
                          disabled={d.alreadyImported}
                          onChange={e => setEdit(d.externalId, 'exercise', e.target.value)}
                          className="mt-1 w-full text-sm font-medium bg-transparent text-pens-cream border border-transparent hover:border-pens-muted/30 focus:border-pens-muted/50 focus:outline-none rounded px-1 py-0.5 disabled:bg-transparent disabled:text-pens-cream/40"
                        />
                        <input
                          value={editedNotes}
                          disabled={d.alreadyImported}
                          onChange={e => setEdit(d.externalId, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="mt-0.5 w-full text-xs bg-transparent text-pens-cream/60 placeholder:text-pens-cream/30 border border-transparent hover:border-pens-muted/30 focus:border-pens-muted/50 focus:outline-none rounded px-1 py-0.5 disabled:bg-transparent"
                        />
                      </div>
                      {!d.alreadyImported && (
                        <button
                          onClick={() => skipDraft(d.externalId)}
                          className="text-xs text-pens-cream/40 hover:text-red-400 px-1.5 py-0.5"
                          title="Discard this pushed workout"
                        >
                          Skip
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="flex items-center justify-between pt-2 border-t border-pens-muted/20">
                <span className="text-xs text-pens-cream/40">{selected.size} selected</span>
                <div className="flex items-center gap-2">
                  {drafts.some(d => !d.alreadyImported && !selected.has(d.externalId)) && (
                    <button
                      onClick={clearUnselected}
                      className="text-sm px-3 py-2 rounded-lg border border-pens-muted/30 hover:bg-pens-navy/40 text-pens-cream/70"
                    >
                      Clear unselected
                    </button>
                  )}
                  <button
                    onClick={importSelected}
                    disabled={importing || selected.size === 0}
                    className={`text-sm px-4 py-2 rounded-lg disabled:opacity-50 text-white font-medium ${accentBtn}`}
                  >
                    {importing ? 'Importing…' : `Import ${selected.size}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {status?.connected && provider.authMode === 'pairing' && (
        <div className="space-y-3 pt-2 border-t border-pens-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-pens-cream">Skipped workouts</h3>
            <label className="text-xs text-pens-cream/60 flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showSkipped}
                onChange={e => setShowSkipped(e.target.checked)}
                className="accent-pens-crimson"
              />
              Show skipped
              {showSkipped && (
                <span className="text-pens-cream/40">· {skipped.length}</span>
              )}
            </label>
          </div>

          {showSkipped && (
            <>
              {skippedError && (
                <div className="text-sm bg-pens-crimson/15 border border-pens-crimson/40 text-red-300 rounded-lg px-3 py-2">
                  {skippedError}
                </div>
              )}
              {loadingSkipped ? (
                <p className="text-sm text-pens-cream/40">Loading skipped…</p>
              ) : skipped.length === 0 ? (
                <p className="text-sm text-pens-cream/40">
                  Nothing skipped yet. Discarded workouts will appear here so you can put them back.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-1.5 text-pens-cream/60">
                      <input
                        type="checkbox"
                        checked={skippedSelected.size === skipped.length && skipped.length > 0}
                        ref={el => {
                          if (el) {
                            el.indeterminate =
                              skippedSelected.size > 0 && skippedSelected.size < skipped.length
                          }
                        }}
                        onChange={toggleSkippedAll}
                        className="accent-pens-crimson"
                      />
                      Select all
                    </label>
                    <span className="text-pens-cream/40">{skippedSelected.size} selected</span>
                  </div>

                  {(() => {
                    const groups = new Map<string, SkippedItem[]>()
                    for (const s of skipped) {
                      const key = s.date ?? '—'
                      const arr = groups.get(key)
                      if (arr) arr.push(s); else groups.set(key, [s])
                    }
                    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                      if (a === '—') return 1
                      if (b === '—') return -1
                      return b.localeCompare(a)
                    })
                    return (
                      <div className="space-y-4">
                        {sortedKeys.map(dateKey => {
                          const items = groups.get(dateKey)!
                          const ids = items.map(i => i.externalId)
                          const anyBusy = ids.some(id => unskipping.has(id))
                          return (
                            <div key={dateKey}>
                              <div className="flex items-center justify-between pb-1 border-b border-pens-muted/10">
                                <span className="text-xs font-semibold text-pens-cream/60 tabular-nums">
                                  {dateKey === '—' ? 'Undated' : dateKey}
                                  <span className="ml-2 text-pens-cream/40 font-normal">
                                    ({items.length})
                                  </span>
                                </span>
                                <button
                                  onClick={() => unskipMany(ids)}
                                  disabled={anyBusy}
                                  className="text-xs px-2 py-1 rounded border border-pens-muted/30 hover:bg-pens-navy/40 text-pens-cream/70 disabled:opacity-50"
                                  title="Un-skip every workout from this day"
                                >
                                  Un-skip all from this day
                                </button>
                              </div>
                              <ul className="divide-y divide-pens-muted/10">
                                {items.map(s => {
                                  const busy = unskipping.has(s.externalId)
                                  const isSelected = skippedSelected.has(s.externalId)
                                  return (
                                    <li key={s.externalId} className="py-3 flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSkipped(s.externalId)}
                                        className="mt-1.5 accent-pens-crimson"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] uppercase tracking-wide text-pens-cream/50 bg-pens-navy/60 rounded px-1.5 py-0.5">
                                            {provider.name}
                                          </span>
                                          <span className="text-[10px] text-pens-cream/40">
                                            skipped {new Date(s.skippedAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-pens-cream/80 truncate">
                                          {s.exercise ?? <span className="text-pens-cream/40 italic">unknown workout</span>}
                                        </div>
                                        {s.notes && (
                                          <div className="mt-0.5 text-xs text-pens-cream/50 truncate">{s.notes}</div>
                                        )}
                                        <div className="mt-0.5 text-[10px] text-pens-cream/30 truncate" title={s.externalId}>
                                          {s.externalId}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => unskipOne(s.externalId)}
                                        disabled={busy}
                                        className="text-xs px-2 py-1 rounded border border-pens-muted/30 hover:bg-pens-navy/40 text-pens-cream/70 disabled:opacity-50"
                                        title="Remove the tombstone so the next companion sync re-ingests this workout"
                                      >
                                        {busy ? 'Un-skipping…' : 'Un-skip'}
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  <div className="flex items-center justify-end pt-2 border-t border-pens-muted/10">
                    <button
                      onClick={() => {
                        setFlash(null)
                        unskipMany(Array.from(skippedSelected))
                      }}
                      disabled={
                        skippedSelected.size === 0 ||
                        Array.from(skippedSelected).some(id => unskipping.has(id))
                      }
                      className={`text-sm px-4 py-2 rounded-lg disabled:opacity-50 text-white font-medium ${accentBtn}`}
                    >
                      Un-skip selected ({skippedSelected.size})
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function IntegrationsInner() {
  const sp = useSearchParams()

  const bannerFor = (id: ProviderId): Banner | null => {
    if (sp.get(`${id}_connected`) === '1') return { kind: 'ok', msg: `${id} connected.` }
    const err = sp.get(`${id}_error`)
    if (err) return { kind: 'err', msg: `${id} error: ${err}` }
    return null
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/" className="text-xs text-pens-cream/40 hover:text-pens-cream/70">← MY PENS</Link>
          <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold mt-2">P.E.N.S.</p>
          <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Integrations</h1>
          <p className="text-sm text-pens-cream/40">Connect external sources to MY PENS.</p>
        </div>

        <div className="rounded-2xl border border-pens-muted/20 bg-pens-surface/60 p-4 flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-pens-cream">Garmin historical archive</p>
            <p className="text-xs text-pens-cream/50">Bulk-import years of <code className="bg-pens-navy/60 px-1 rounded text-pens-cream/70">.fit</code> files (separate from the live OAuth sync below).</p>
          </div>
          <Link href="/garmin" className="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700">Open archive →</Link>
        </div>

        <WebhookSyncStrip />

        {PROVIDERS.map(p => (
          <ProviderCard key={p.id} provider={p} banner={bannerFor(p.id)} />
        ))}
      </div>
    </main>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-pens-cream/40 bg-pens-deep min-h-screen">Loading…</div>}>
      <IntegrationsInner />
    </Suspense>
  )
}
