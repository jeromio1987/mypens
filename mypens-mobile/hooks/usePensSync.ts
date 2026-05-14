import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { flushOfflineQueue, queueLength } from '@/lib/offlineQueue'
import { isPensApiConfigured } from '@/lib/pensApi'

export function usePensSync() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)

  const refresh = useCallback(() => {
    void queueLength().then(setPending)
  }, [])

  useEffect(() => {
    refresh()
    const unsubNet = NetInfo.addListener((s) => {
      const isOnline = Boolean(s.isConnected && s.isInternetReachable !== false)
      setOnline(isOnline)
      if (isOnline && isPensApiConfigured()) {
        void flushOfflineQueue().then(refresh)
      }
    })
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && isPensApiConfigured()) {
        void flushOfflineQueue().then(refresh)
      }
    })
    return () => {
      unsubNet()
      sub.remove()
    }
  }, [refresh])

  return { pending, online, refresh }
}
