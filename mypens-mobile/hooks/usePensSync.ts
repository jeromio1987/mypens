import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState } from 'react-native'
import * as NetInfoNS from '@react-native-community/netinfo'
import { flushOfflineQueue, queueLength, readDeadLetter } from '@/lib/offlineQueue'
import { isPensApiConfigured } from '@/lib/pensApi'

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null }

/** Metro/Expo sometimes expose default export oddly — normalize. */
function getNetInfo() {
  const mod = NetInfoNS as unknown as {
    default?: {
      addEventListener?: (listener: (s: NetState) => void) => () => void
      fetch?: () => Promise<NetState>
    }
    addEventListener?: (listener: (s: NetState) => void) => () => void
    fetch?: () => Promise<NetState>
  }
  return mod.default ?? mod
}

async function alertDroppedBad(droppedBad: number) {
  if (droppedBad <= 0) return
  const dead = await readDeadLetter()
  const deadNote =
    dead.length > 0
      ? ` Dead letter now holds ${dead.length} entr${dead.length === 1 ? 'y' : 'ies'}.`
      : ''
  Alert.alert(
    'Sync rejected entries',
    `${droppedBad} queued change${droppedBad > 1 ? 's were' : ' was'} rejected by the API and saved to dead letter (not silently dropped).${deadNote} Check your API token and open /api/health on the phone browser.`,
  )
}

/**
 * Shared flush for screens — always reads droppedBad and alerts.
 * Prefer this (or hook.flush) over bare flushOfflineQueue().
 */
export async function flushOfflineQueueWithAlert(options?: { max?: number }) {
  const result = await flushOfflineQueue(options)
  await alertDroppedBad(result.droppedBad)
  return result
}

export function usePensSync() {
  const [pending, setPending] = useState(0)
  const [deadLetter, setDeadLetter] = useState(0)
  const [online, setOnline] = useState(true)
  // Per-hook debounce only — real serialization is module inFlight in offlineQueue.ts
  const flushing = useRef(false)

  const refresh = useCallback(() => {
    void queueLength().then(setPending)
    void readDeadLetter().then((d) => setDeadLetter(d.length))
  }, [])

  const runFlush = useCallback(async () => {
    if (!isPensApiConfigured() || flushing.current) return
    flushing.current = true
    try {
      await flushOfflineQueueWithAlert()
      refresh()
    } finally {
      flushing.current = false
    }
  }, [refresh])

  useEffect(() => {
    refresh()

    let unsubNet: (() => void) | undefined
    try {
      const NetInfo = getNetInfo()
      if (typeof NetInfo.addEventListener === 'function') {
        unsubNet = NetInfo.addEventListener((s) => {
          const isOnline = Boolean(s.isConnected && s.isInternetReachable !== false)
          setOnline(isOnline)
          if (isOnline) {
            void runFlush()
          }
        })
      }
      if (typeof NetInfo.fetch === 'function') {
        void NetInfo.fetch().then((s) => {
          setOnline(Boolean(s.isConnected && s.isInternetReachable !== false))
        })
      }
    } catch {
      // NetInfo native module missing in some Expo Go / reload states — stay online.
      setOnline(true)
    }

    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void runFlush()
      }
    })

    return () => {
      unsubNet?.()
      sub.remove()
    }
  }, [refresh, runFlush])

  return { pending, deadLetter, online, refresh, flush: runFlush }
}
