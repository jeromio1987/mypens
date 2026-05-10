'use client'

import { Lock } from 'lucide-react'
import { useTier } from '@/hooks/useTier'

type PremiumGateProps = {
  feature: string
  /** Match the gated content corners (buttons often `rounded-lg`, cards `rounded-2xl`). */
  className?: string
  children: React.ReactNode
}

/**
 * Free tier: children stay in layout; a non-interactive overlay + lock + badge.
 * Premium or still loading: children only.
 */
export default function PremiumGate({ feature, className = 'rounded-lg', children }: PremiumGateProps) {
  const { isPremium, isLoading } = useTier()

  if (isPremium || isLoading) {
    return <>{children}</>
  }

  const radius = className.includes('rounded-') ? className.match(/rounded-[^\s]+/)?.[0] ?? 'rounded-lg' : 'rounded-lg'

  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        className={`absolute inset-0 z-10 ${radius} bg-pens-deep/55 pointer-events-none`}
        title={feature}
        aria-hidden
      />
      <div
        className={`absolute inset-0 z-20 ${radius} cursor-default`}
        title={feature}
        role="presentation"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-1 pointer-events-none">
        <Lock size={14} className="text-pens-gold" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide text-pens-gold bg-black/40 px-1.5 py-0.5 rounded border border-pens-gold/30">
          Premium
        </span>
      </div>
    </div>
  )
}
