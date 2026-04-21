'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Status {
  configured: boolean
  connected: boolean
  athleteId: string | null
  scope: string | null
  lastSyncAt: string | null
  expiresAt: number | null
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
  source: 'strava'
  externalId: string
  externalUrl: string
  externalRaw: string
  alreadyImported: boolean
}

function IntegrationsInner() {
  const sp = useSearchParams()
  const [status, setStatus] = useState<Status | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [activitiesError, setActivitiesError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, { exercise?: string; notes?: string }>>({})
  const [importing, setImporting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const banner =
    sp.get('strava_connected') === '1'
      ? { kind: 'ok' as const, msg: 'Strava connected.' }
      : sp.get('strava_error')
        ? { kind: 'err' as const, msg: `Strava error: ${sp.get('strava_error')}` }
        : null

  const loadStatus = () => {
    setLoadingStatus(true)
    fetch('/api/integrations/strava/status')
      .then(r => r.json())
      .then(setStatus)
      .finally(() => setLoadingStatus(false))
  }

  useEffect(() => { loadStatus() }, [])

  const loadActivities = async () => {
    setLoadingActivities(true)
    setActivitiesError(null)
    setDrafts([])
    setSelected(new Set())
    try {
      const res = await fetch('/api/integrations/strava/activities?days=30')
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
  }

  useEffect(() => {
    if (status?.connected) loadActivities()
  }, [status?.connected])

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
      const res = await fetch('/api/integrations/strava/import', {
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

  const disconnect = async () => {
    if (!confirm('Disconnect Strava? Imported entries will remain but lose the live link.')) return
    await fetch('/api/integrations/strava/disconnect', { method: 'POST' })
    setDrafts([])
    setSelected(new Set())
    loadStatus()
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← MY PENS</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Integrations</h1>
          <p className="text-sm text-gray-400">Connect external sources to MY PENS.</p>
        </div>

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

        {/* Strava card */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-orange-500 text-white text-xs font-bold">
                  S
                </span>
                <h2 className="text-lg font-semibold">Strava</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Pull your last 30 days of activities into the Training log.
              </p>
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
                  className="text-sm px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium"
                >
                  {loadingActivities ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={disconnect}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <a
                href="/api/integrations/strava/authorize"
                className={`text-sm px-4 py-2 rounded-lg font-medium text-white ${
                  status?.configured
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-gray-300 pointer-events-none'
                }`}
              >
                Connect Strava
              </a>
            )}
          </div>

          {!status?.configured && !loadingStatus && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Set <code>STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> environment
              variables to enable Strava.
            </p>
          )}
        </div>

        {/* Review */}
        {status?.connected && (
          <div className="bg-white rounded-2xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Review pending activities</h3>
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
              <p className="text-sm text-gray-400">No activities found in the last 30 days.</p>
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
                            <a
                              href={d.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-orange-500 hover:text-orange-600"
                            >
                              View on Strava ↗
                            </a>
                          </div>
                          <input
                            value={editedExercise}
                            disabled={d.alreadyImported}
                            onChange={e => setEdit(d.externalId, 'exercise', e.target.value)}
                            className="mt-1 w-full text-sm font-medium border border-transparent hover:border-gray-200 focus:border-orange-300 rounded px-1 py-0.5 disabled:bg-transparent disabled:text-gray-400"
                          />
                          <input
                            value={editedNotes}
                            disabled={d.alreadyImported}
                            onChange={e => setEdit(d.externalId, 'notes', e.target.value)}
                            placeholder="Notes"
                            className="mt-0.5 w-full text-xs text-gray-500 border border-transparent hover:border-gray-200 focus:border-orange-300 rounded px-1 py-0.5 disabled:bg-transparent"
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {selected.size} selected
                  </span>
                  <button
                    onClick={importSelected}
                    disabled={importing || selected.size === 0}
                    className="text-sm px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium"
                  >
                    {importing ? 'Importing…' : `Import ${selected.size}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
