import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

const KEY = '@mypens/selected_date'

export function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Shared yyyy-mm-dd across Fueling / Weight / Sleep / Journal so tab switches keep the day.
 * Persists lightly in AsyncStorage; clamps future dates back to today.
 */
export function useSelectedDate(initial?: string) {
  const [date, setDateState] = useState(initial ?? isoToday())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY)
        if (!cancelled && raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          const today = isoToday()
          setDateState(raw > today ? today : raw)
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setDate = useCallback((next: string) => {
    const today = isoToday()
    const safe = next > today ? today : next
    setDateState(safe)
    void AsyncStorage.setItem(KEY, safe)
  }, [])

  return { date, setDate, ready }
}
