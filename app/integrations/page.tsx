'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
    description: 'Pull recent workouts from Garmin Connect into the Training log.',
    authMode: 'oauth',
    syncLabel: 'Sync now',
    envHint: 'GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET',
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
  expiresAt?: number | null
  webhookActive?: boolean
  lastError?: string | null
  lastErrorAt?: string | null
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

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => {
    if (status?.connected) loadActivities()
  }, [status?.connected, loadActivities])

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
    <div className="bg-white rounded-2xl shadow p-6 space-y-4">
      {banner && (
        <div
          className={`text-sm rounded-lg px-3 py-2 border ${
            banner.kind === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
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
            <h2 className="text-lg font-semibold">{provider.name}</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">{provider.description}</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          {loadingStatus ? (
            'Loading…'
          ) : !status?.configured ? (
            <span className="text-amber-600">Not configured</span>
          ) : status.connected ? (
            <>
              <div className="text-green-600 font-medium">Connected</div>
              {status.athleteId && <div>Athlete #{status.athleteId}</div>}
              {status.deviceLabel && <div>{status.deviceLabel}</div>}
              {typeof status.pendingCount === 'number' && (
                <div>{status.pendingCount} pending</div>
              )}
              {provider.id === 'strava' && (
                <div className={status.webhookActive ? 'text-green-600' : 'text-gray-400'}>
                  Webhook: {status.webhookActive ? 'active' : 'inactive'}
                </div>
              )}
              {status.lastSyncAt && (
                <div>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</div>
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
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
              >
                {issuingToken ? 'Rotating…' : 'Rotate token'}
              </button>
            )}
            <button
              onClick={disconnect}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              Disconnect
            </button>
          </>
        ) : provider.authMode === 'oauth' ? (
          <a
            href={`${base}/authorize`}
            className={`text-sm px-4 py-2 rounded-lg font-medium text-white ${
              status?.configured ? accentBtn : 'bg-gray-300 pointer-events-none'
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

      {status?.connected && status.lastError && (
        <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          <span className="font-medium">Last sync error:</span> {status.lastError}
          {status.lastErrorAt && (
            <span className="text-red-500"> · {new Date(status.lastErrorAt).toLocaleString()}</span>
          )}
        </div>
      )}

      {!status?.configured && !loadingStatus && provider.authMode === 'oauth' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set <code>{provider.envHint}</code> environment variables to enable {provider.name}.
        </p>
      )}

      {pairingToken && (
        <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
          <div className="font-medium text-amber-800">Pairing token (save this now — shown once)</div>
          <code className="block break-all bg-white border border-amber-100 rounded px-2 py-1 text-amber-900">
            {pairingToken}
          </code>
          {provider.pairingInstructions && (
            <p className="text-amber-700">{provider.pairingInstructions}</p>
          )}
        </div>
      )}

      {status?.connected && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Review pending activities</h3>
            <span className="text-xs text-gray-400">
              {drafts.length} found · {drafts.filter(d => !d.alreadyImported).length} new
            </span>
          </div>

          {activitiesError && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
              {activitiesError}
            </div>
          )}

          {flash && (
            <div className="text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
              {flash}
            </div>
          )}

          {loadingActivities ? (
            <p className="text-sm text-gray-400">Loading activities…</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-gray-400">
              {provider.authMode === 'pairing'
                ? 'No workouts pushed yet from the companion app.'
                : 'No activities found in the recent window.'}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
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
                        className="mt-1.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 tabular-nums">{d.date}</span>
                          {d.alreadyImported && (
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                              Already imported
                            </span>
                          )}
                          {d.externalUrl && provider.externalLinkLabel && (
                            <a
                              href={d.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-gray-500 hover:text-gray-700"
                            >
                              {provider.externalLinkLabel}
                            </a>
                          )}
                        </div>
                        <input
                          value={editedExercise}
                          disabled={d.alreadyImported}
                          onChange={e => setEdit(d.externalId, 'exercise', e.target.value)}
                          className="mt-1 w-full text-sm font-medium border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-1 py-0.5 disabled:bg-transparent disabled:text-gray-400"
                        />
                        <input
                          value={editedNotes}
                          disabled={d.alreadyImported}
                          onChange={e => setEdit(d.externalId, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="mt-0.5 w-full text-xs text-gray-500 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded px-1 py-0.5 disabled:bg-transparent"
                        />
                      </div>
                      {!d.alreadyImported && (
                        <button
                          onClick={() => skipDraft(d.externalId)}
                          className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-0.5"
                          title="Discard this pushed workout"
                        >
                          Skip
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{selected.size} selected</span>
                <div className="flex items-center gap-2">
                  {drafts.some(d => !d.alreadyImported && !selected.has(d.externalId)) && (
                    <button
                      onClick={clearUnselected}
                      className="text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
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
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← MY PENS</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Integrations</h1>
          <p className="text-sm text-gray-400">Connect external sources to MY PENS.</p>
        </div>

        {PROVIDERS.map(p => (
          <ProviderCard key={p.id} provider={p} banner={bannerFor(p.id)} />
        ))}
      </div>
    </main>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <IntegrationsInner />
    </Suspense>
  )
}
