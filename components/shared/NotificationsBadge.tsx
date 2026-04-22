'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'

interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  createdAt: string
}

/**
 * Sits next to SyncStatusBadge and surfaces unread in-app notifications
 * (currently only emitted by the stale-pairing cron). Keeps the markup
 * small and visually consistent with the existing badge — single line of
 * status, click-through to the actionable page, dismiss to mark read.
 */
export default function NotificationsBadge() {
  const [items, setItems] = useState<NotificationItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/notifications')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return
        setItems(Array.isArray(d?.items) ? d.items : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => { cancelled = true }
  }, [])

  if (!items || items.length === 0) return null

  const primary = items[0]
  const more = items.length - 1
  const label = items.length === 1
    ? primary.title
    : `${primary.title} (+${more})`
  const href = primary.href ?? '/integrations'

  async function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!items) return
    const ids = items.map(i => i.id)
    setItems([])
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch {
      // Silent — the next refresh will reconcile.
    }
  }

  return (
    <Link
      href={href}
      title={items.map(i => `${i.title}\n${i.body}`).join('\n\n')}
      className="flex items-center gap-2 w-full bg-pens-gold/15 border border-pens-gold/40 rounded-xl px-3 py-2 text-pens-cream hover:bg-pens-gold/25 transition-colors"
    >
      <Bell size={14} className="text-pens-gold shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-widest text-pens-gold/80 font-semibold leading-none mb-0.5">
          Heads up
        </p>
        <p className="text-xs font-semibold text-pens-cream truncate">{label}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-pens-cream/50 hover:text-pens-cream shrink-0"
      >
        <X size={12} />
      </button>
    </Link>
  )
}
