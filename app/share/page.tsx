'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'

export default function SharePage() {
  const [ttlHours, setTtlHours] = useState(168)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }, [ttlHours])

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
            change your data.
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
      </div>
    </main>
  )
}
