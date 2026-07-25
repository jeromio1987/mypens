'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const search = useSearchParams()
  const next = search.get('next') || '/'
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    if (password.trim().length === 0) {
      setError('Enter your password.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null

      if (res.ok) {
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
        // Hard navigation so the session cookie is always picked up by proxy.
        window.location.assign(safeNext)
        return
      }

      if (res.status === 503) {
        setError(data?.error || 'Server is not configured for authentication.')
      } else if (res.status === 401) {
        setError('Invalid password — check OWNER_PASSWORD in your .env (local) or Vercel env (prod).')
      } else {
        setError(data?.error || `Sign-in failed (${res.status}).`)
      }
      setSubmitting(false)
    } catch {
      setError('Network error — is the Next server running on this URL?')
      setSubmitting(false)
    }
  }

  const notReady = password.trim().length === 0

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-pens-muted/20 bg-pens-surface/40 p-6 space-y-4"
    >
      <label className="block">
        <span className="text-xs uppercase tracking-[0.2em] text-pens-cream/60">Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          autoFocus
          autoComplete="current-password"
          className="mt-2 w-full rounded-md bg-pens-deep border border-pens-muted/30 px-3 py-2 text-pens-cream focus:outline-none focus:border-pens-crimson"
          required
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/50 bg-red-950/60 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        aria-disabled={submitting || notReady}
        className={`w-full rounded-md bg-pens-crimson px-4 py-2 text-pens-cream font-semibold uppercase tracking-wide text-sm ${
          submitting || notReady ? 'opacity-50' : ''
        }`}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
