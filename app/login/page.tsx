import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { isAuthDisabled } from '@/lib/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  // Auth off → no password gate; send straight home.
  if (isAuthDisabled()) {
    redirect('/')
  }

  const configured = Boolean(
    process.env.SESSION_SECRET?.trim() && process.env.OWNER_PASSWORD?.trim(),
  )
  // Length only — helps catch “wrong remembered password” without leaking the value.
  const passwordLength = (process.env.OWNER_PASSWORD || '').trim().length
  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="font-[family-name:var(--font-headline)] italic text-pens-cream/40 text-[10px] uppercase tracking-[0.3em] mb-2">
            The Continental
          </p>
          <p className="font-[family-name:var(--font-headline)] text-pens-cream text-5xl font-extrabold italic leading-none">
            MY PENS
          </p>
          <div className="h-px w-16 bg-pens-crimson mx-auto mt-3" />
        </div>

        {configured ? (
          <Suspense
            fallback={
              <div className="rounded-xl border border-pens-muted/20 bg-pens-surface/40 p-6 text-sm text-pens-cream/60">
                Loading sign-in…
              </div>
            }
          >
            <LoginForm passwordLength={passwordLength} />
          </Suspense>
        ) : (
          <div className="rounded-xl border border-pens-crimson/40 bg-pens-surface/40 p-6 text-sm text-pens-cream/80">
            <p className="font-semibold text-pens-cream mb-2">Authentication is not configured.</p>
            <p>
              Set <code className="bg-pens-deep/60 px-1 rounded">SESSION_SECRET</code> and{' '}
              <code className="bg-pens-deep/60 px-1 rounded">OWNER_PASSWORD</code> in the project{' '}
              <code className="bg-pens-deep/60 px-1 rounded">.env</code> (local) or Vercel env
              (production), then restart the Next server and reload. Or set{' '}
              <code className="bg-pens-deep/60 px-1 rounded">MYPENS_AUTH_DISABLED=true</code> for
              local no-password access.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
