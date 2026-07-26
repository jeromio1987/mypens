import React, { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'

import { useColors } from '@/hooks/useColors'
import { pensFetch } from '@/lib/pensApi'

const AMBER = '#f59e0b'

export function FoodIncompleteMobile({
  date,
  onChanged,
}: {
  date: string
  onChanged?: () => void
}) {
  const colors = useColors()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await pensFetch(`/api/day-flags?date=${encodeURIComponent(date)}`)
        if (!res.ok) return
        const j = (await res.json()) as { foodIncomplete?: boolean }
        if (!cancelled) setOn(Boolean(j.foodIncomplete))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  async function toggle() {
    const next = !on
    setBusy(true)
    setOn(next)
    try {
      const res = await pensFetch('/api/day-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, foodIncomplete: next }),
      })
      if (!res.ok) setOn(!next)
      else onChanged?.()
    } catch {
      setOn(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={busy}
      style={{
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: on ? AMBER : colors.border,
        backgroundColor: on ? 'rgba(245,158,11,0.12)' : colors.card,
      }}
    >
      <Text style={{ color: on ? AMBER : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
        {on ? 'Food marked incomplete for this day' : 'Mark food incomplete (late / partial log)'}
      </Text>
    </Pressable>
  )
}
