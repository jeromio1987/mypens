'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, Zap, ArrowLeft } from 'lucide-react'
import { useTier, setTierInStore } from '@/hooks/useTier'

const FREE_FEATURES = [
  'Weight logging + true-weight engine',
  'Food & calorie tracker',
  'Sleep logging',
  'Training journal',
  'Body measurements',
  'Garmin activity sync',
  'HealthKit / Health Connect sync',
  'Bloodwork panel tracker',
  'Anchor recovery module',
  'Investing watchlist',
]

const PREMIUM_FEATURES = [
  'Everything in Free',
  'AI Weekly Verdict (Claude-powered)',
  'AI Longevity Lens — blood marker insights',
  'Wearable context engine (HRV + sleep impact)',
  'PDF weekly reports',
  'Garmin body composition + sleep sync',
  'Clubroom multi-user leaderboard',
  'Priority support',
]

export default function UpgradePage() {
  const { isPremium, isLoading } = useTier()
  const params = useSearchParams()
  const [working, setWorking] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (params.get('success') === 'true') {
      setTierInStore('premium')
      setFlash('Welcome to Premium! Your account has been upgraded.')
    } else if (params.get('cancelled') === 'true') {
      setFlash('Checkout cancelled — no charge was made.')
    }
  }, [params])

  async function handleUpgrade() {
    setWorking(true)
    try {
      const res = await fetch('/api/payments/checkout', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Something went wrong')
      setWorking(false)
    }
  }

  async function handlePortal() {
    setWorking(true)
    try {
      const res = await fetch('/api/payments/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Something went wrong')
      setWorking(false)
    }
  }

  return (
    <main className="min-h-screen bg-pens-deep px-4 py-10 text-pens-cream">
      <div className="max-w-3xl mx-auto space-y-8">

        <div>
          <Link href="/" className="text-xs uppercase tracking-widest text-pens-cream/40 hover:text-pens-cream/70 flex items-center gap-1">
            <ArrowLeft size={12} /> MY PENS
          </Link>
          <h1 className="text-3xl font-bold mt-2">Upgrade to Premium</h1>
          <p className="text-pens-cream/60 mt-1">AI-powered insights. €4.99/month. Cancel anytime.</p>
        </div>

        {flash && (
          <div className="bg-pens-surface border border-pens-gold/40 rounded-xl px-4 py-3 text-sm text-pens-cream">
            {flash}
          </div>
        )}

        {isLoading ? (
          <div className="h-20 flex items-center justify-center text-pens-cream/40 text-sm">Loading…</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Free tier */}
            <div className="bg-pens-surface rounded-2xl p-6 border border-pens-muted/30 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-pens-muted font-semibold">Free</p>
                <p className="text-2xl font-bold mt-1">€0</p>
                <p className="text-xs text-pens-cream/50">forever</p>
              </div>
              <ul className="space-y-2">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-pens-cream/70">
                    <Check size={14} className="text-pens-muted mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isPremium && (
                <div className="pt-2">
                  <div className="w-full text-center py-2 rounded-xl border border-pens-muted/30 text-xs text-pens-muted">
                    Current plan
                  </div>
                </div>
              )}
            </div>

            {/* Premium tier */}
            <div className="bg-pens-surface rounded-2xl p-6 border border-pens-gold/50 ring-1 ring-pens-gold/20 space-y-4 relative">
              <div className="absolute top-4 right-4">
                <Zap size={16} className="text-pens-gold" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-pens-gold font-semibold">Premium</p>
                <p className="text-2xl font-bold mt-1">€4.99</p>
                <p className="text-xs text-pens-cream/50">per month</p>
              </div>
              <ul className="space-y-2">
                {PREMIUM_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-pens-cream/80">
                    <Check size={14} className="text-pens-gold mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                {isPremium ? (
                  <button
                    onClick={handlePortal}
                    disabled={working}
                    className="w-full py-2.5 rounded-xl bg-pens-surface border border-pens-gold/50 text-pens-gold text-sm font-medium hover:bg-pens-gold/10 disabled:opacity-50 transition"
                  >
                    {working ? 'Redirecting…' : 'Manage subscription'}
                  </button>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={working}
                    className="w-full py-2.5 rounded-xl bg-pens-gold text-pens-deep text-sm font-bold hover:bg-pens-gold/90 disabled:opacity-50 transition"
                  >
                    {working ? 'Redirecting to Stripe…' : 'Upgrade — €4.99/month'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-pens-cream/30 text-center">
          Secure payments via Stripe. Your health data stays local and never leaves your server.
        </p>
      </div>
    </main>
  )
}
