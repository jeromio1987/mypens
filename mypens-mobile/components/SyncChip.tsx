import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'
import { buildSyncChipState, type SyncSourceStatus } from '@/lib/syncChip'

type StatusPayload = {
  connected?: boolean
  lastSyncAt?: string | null
  lastSuccessAt?: string | null
  lastError?: string | null
  lastErrorAt?: string | null
}

/** WP 1.4 — permanent sync chip; opens Audit. */
export function SyncChip() {
  const colors = useColors()
  const router = useRouter()
  const [sources, setSources] = useState<SyncSourceStatus[]>([])

  useEffect(() => {
    if (!isPensApiConfigured()) return
    let cancelled = false
    ;(async () => {
      const endpoints: { id: SyncSourceStatus['id']; label: string; path: string }[] = [
        { id: 'garmin', label: 'Garmin', path: '/api/integrations/garmin/status' },
        { id: 'healthconnect_sleep', label: 'HC sleep', path: '/api/integrations/healthconnect/status' },
        { id: 'healthconnect_workouts', label: 'HC workouts', path: '/api/integrations/healthconnect/status' },
      ]
      const rows: SyncSourceStatus[] = []
      for (const ep of endpoints) {
        try {
          const res = await pensFetch(ep.path)
          const d = res.ok ? ((await res.json()) as StatusPayload) : null
          rows.push({
            id: ep.id,
            label: ep.label,
            connected: Boolean(d?.connected),
            lastSuccessAt: d?.lastSuccessAt ?? d?.lastSyncAt ?? null,
            lastError: d?.lastError ? String(d.lastError) : null,
            lastErrorAt: d?.lastErrorAt ?? null,
          })
        } catch {
          rows.push({
            id: ep.id,
            label: ep.label,
            connected: false,
            lastSuccessAt: null,
            lastError: null,
            lastErrorAt: null,
          })
        }
      }
      if (!cancelled) setSources(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isPensApiConfigured() || sources.length === 0) return null

  const state = buildSyncChipState(sources)
  const label = state.primaryError
    ? `${state.primaryError.label} issue`
    : state.lastAnySuccessAt
      ? `Sync OK · ${new Date(state.lastAnySuccessAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : 'Sync'

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/audit' as never)}
      style={[
        styles.chip,
        {
          backgroundColor: state.primaryError ? 'rgba(185,28,28,0.18)' : colors.card,
          borderColor: state.primaryError ? 'rgba(185,28,28,0.45)' : colors.border,
        },
      ]}
    >
      <Feather
        name={state.primaryError ? 'alert-triangle' : 'check-circle'}
        size={14}
        color={state.primaryError ? '#f87171' : '#34d399'}
      />
      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>Audit</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
})
