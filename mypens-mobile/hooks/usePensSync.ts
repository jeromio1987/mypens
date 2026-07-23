import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import * as NetInfoNS from '@react-native-community/netinfo'
import { flushOfflineQueue, queueLength } from '@/lib/offlineQueue'
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

export function usePensSync() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)

  const refresh = useCallback(() => {
    void queueLength().then(setPending)
  }, [])

  useEffect(() => {
    refresh()

    let unsubNet: (() => void) | undefined
    try {
      const NetInfo = getNetInfo()
      if (typeof NetInfo.addEventListener === 'function') {
        unsubNet = NetInfo.addEventListener((s) => {
          const isOnline = Boolean(s.isConnected && s.isInternetReachable !== false)
          setOnline(isOnline)
          if (isOnline && isPensApiConfigured()) {
            void flushOfflineQueue().then(refresh)
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
      if (st === 'active' && isPensApiConfigured()) {
        void flushOfflineQueue().then(refresh)
      }
    })

    return () => {
      unsubNet?.()
      sub.remove()
    }
  }, [refresh])

  return { pending, online, refresh }
}
