import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const configured = Boolean(process.env.SESSION_SECRET && process.env.OWNER_PASSWORD)
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
          <LoginForm />
        ) : (
          <div className="rounded-xl border border-pens-crimson/40 bg-pens-surface/40 p-6 text-sm text-pens-cream/80">
            <p className="font-semibold text-pens-cream mb-2">Authentication is not configured.</p>
            <p>
              Set the <code className="bg-pens-deep/60 px-1 rounded">SESSION_SECRET</code> and
              {' '}<code className="bg-pens-deep/60 px-1 rounded">OWNER_PASSWORD</code> environment
              variables in the Replit Secrets tab, then reload this page.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
