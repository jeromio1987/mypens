'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/'
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
        router.push(safeNext)
        router.refresh()
        return
      }
      if (res.status === 503) {
        setError('Server is not configured for authentication.')
      } else {
        setError('Invalid password.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-pens-muted/20 bg-pens-surface/40 p-6 space-y-4"
    >
      <label className="block">
        <span className="text-xs uppercase tracking-[0.2em] text-pens-cream/60">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="mt-2 w-full rounded-md bg-pens-deep border border-pens-muted/30 px-3 py-2 text-pens-cream focus:outline-none focus:border-pens-crimson"
          required
        />
      </label>

      {error ? (
        <p className="text-sm text-pens-crimson">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="w-full rounded-md bg-pens-crimson px-4 py-2 text-pens-cream font-semibold uppercase tracking-wide text-sm disabled:opacity-50"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
