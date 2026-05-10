'use client'

import { useEffect, useSyncExternalStore } from 'react'

export type Tier = 'free' | 'premium'

type Snapshot = { tier: Tier; loading: boolean }

let snapshot: Snapshot = { tier: 'free', loading: true }
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function getSnapshot(): Snapshot {
  return snapshot
}

let hydrateStarted = false

function beginHydrate() {
  if (hydrateStarted) return
  hydrateStarted = true
  void fetch('/api/settings')
    .then(r => (r.ok ? r.json() : { tier: 'free' }))
    .then((j: { tier?: string }) => {
      const tier: Tier = j.tier === 'premium' ? 'premium' : 'free'
      snapshot = { tier, loading: false }
      emit()
    })
    .catch(() => {
      snapshot = { tier: 'free', loading: false }
      emit()
    })
}

/** Dev / PATCH: update store so all `useTier` subscribers see the new tier. */
export function setTierInStore(tier: Tier) {
  snapshot = { tier, loading: false }
  emit()
}

export function useTier(): { tier: Tier; isPremium: boolean; isLoading: boolean } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    beginHydrate()
  }, [])

  return {
    tier: snap.tier,
    isPremium: snap.tier === 'premium',
    isLoading: snap.loading,
  }
}
