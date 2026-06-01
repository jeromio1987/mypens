'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface ShareRow {
  id: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

export default function SharePage() {
  const [ttlHours, setTtlHours] = useState(168)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [links, setLinks] = useState<ShareRow[]>([])
  const [loadingLinks, setLoadingLinks] = useState(true)

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true)
    try {
      const res = await fetch('/api/share-links')
      const data = (await res.json()) as { links?: ShareRow[] }
      if (res.ok && Array.isArray(data.links)) setLinks(data.links)
      else setLinks([])
    } catch {
      setLinks([])
    } finally {
      setLoadingLinks(false)
    }
  }, [])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  const mint = useCallback(async () => {
    setBusy(true)
    setErr(null)
    setCopied(false)
    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlHours }),
      })
      const data = (await res.json()) as { shareUrl?: string; expiresAt?: string | null; error?: string }
      if (!res.ok) {
        setShareUrl(null)
        setExpiresAt(null)
        setErr(typeof data.error === 'string' ? data.error : 'Could not create link')
        return
      }
      setShareUrl(data.shareUrl ?? null)
      setExpiresAt(data.expiresAt ?? null)
      await loadLinks()
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }, [ttlHours, loadLinks])

  const revoke = useCallback(
    async (id: string) => {
      await fetch(`/api/share-links?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await loadLinks()
    },
    [loadLinks],
  )

  const copy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Clipboard not available — copy the URL manually.')
    }
  }, [shareUrl])

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <Link href="/" className="text-xs text-pens-cream/40 hover:text-pens-cream/70">
            ← MY PENS
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold mt-2">P.E.N.S.</p>
          <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Read-only share link</h1>
          <p className="text-sm text-pens-cream/40 mt-1">
            Anyone with the link can view a small weight snapshot (last 7 days, enriched trend fields). They cannot
            change your data. Revoking here invalidates the link immediately.
          </p>
        </div>

        <div className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 space-y-4">
          <label className="block text-xs text-pens-cream/50">
            Link lifetime (hours)
            <input
              type="number"
              min={1}
              max={2160}
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value) || 168)}
              className="mt-1 w-full rounded-lg border border-pens-muted/40 bg-pens-deep px-3 py-2 text-sm text-pens-cream"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void mint()}
            className="w-full rounded-xl bg-pens-gold text-pens-deep px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Generate link'}
          </button>
          {err && <p className="text-sm text-red-300/90">{err}</p>}
          {shareUrl && (
            <div className="space-y-2">
              <p className="text-xs text-pens-cream/45 break-all">{shareUrl}</p>
              {expiresAt && <p className="text-[11px] text-pens-cream/35">Expires: {expiresAt}</p>}
              <button
                type="button"
                onClick={() => void copy()}
                className="text-sm text-pens-gold hover:text-pens-cream"
              >
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-pens-muted/35 bg-pens-navy/80 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-pens-cream">Active &amp; past links</h2>
          {loadingLinks ? (
            <p className="text-xs text-pens-cream/45">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-pens-cream/45">No links minted yet.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((row) => {
                const active = !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now()
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pens-muted/25 bg-pens-deep/50 px-3 py-2 text-[11px]"
                  >
                    <div className="text-pens-cream/80">
                      <span className="font-mono text-[10px] text-pens-cream/40">{row.id.slice(0, 8)}…</span>
                      <span className="mx-2 text-pens-cream/25">·</span>
                      {active ? <span className="text-emerald-400/90">active</span> : <span className="text-pens-cream/45">inactive</span>}
                      <div className="text-pens-cream/35 mt-0.5">
                        Expires {new Date(row.expiresAt).toLocaleString()}
                        {row.revokedAt ? ` · revoked ${new Date(row.revokedAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => void revoke(row.id)}
                        className="text-xs px-2 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
