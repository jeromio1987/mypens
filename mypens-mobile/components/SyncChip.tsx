import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
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
  const [sources, setSources] = useState<SyncSourceStatus[] | null>(null)

  useEffect(() => {
    if (!isPensApiConfigured()) return
    let cancelled = false
    ;(async () => {
      // One Health Connect status endpoint — do not claim separate HC sleep/workouts health.
      const endpoints: { id: SyncSourceStatus['id']; label: string; path: string }[] = [
        { id: 'garmin', label: 'Garmin', path: '/api/integrations/garmin/status' },
        { id: 'healthconnect', label: 'Health Connect', path: '/api/integrations/healthconnect/status' },
      ]
      const rows = await Promise.all(
        endpoints.map(async (ep): Promise<SyncSourceStatus> => {
          try {
            const res = await pensFetch(ep.path)
            if (!res.ok) {
              return {
                id: ep.id,
                label: ep.label,
                connected: false,
                lastSuccessAt: null,
                lastError: `status ${res.status}`,
                lastErrorAt: new Date().toISOString(),
              }
            }
            const d = (await res.json()) as StatusPayload
            return {
              id: ep.id,
              label: ep.label,
              connected: Boolean(d?.connected),
              lastSuccessAt: d?.lastSuccessAt ?? d?.lastSyncAt ?? null,
              lastError: d?.lastError ? String(d.lastError) : null,
              lastErrorAt: d?.lastErrorAt ?? null,
            }
          } catch {
            return {
              id: ep.id,
              label: ep.label,
              connected: false,
              lastSuccessAt: null,
              lastError: 'network error',
              lastErrorAt: new Date().toISOString(),
            }
          }
        }),
      )
      if (!cancelled) setSources(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isPensApiConfigured()) return null

  if (sources == null) {
    return (
      <Pressable
        onPress={() => router.push('/(tabs)/audit' as never)}
        style={[
          styles.chip,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Feather name="loader" size={14} color={colors.mutedForeground} />
        <Text
          style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold', flex: 1 }}
          numberOfLines={1}
        >
          Sync checking…
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_500Medium' }}>
          Audit
        </Text>
      </Pressable>
    )
  }

  const state = buildSyncChipState(sources)
  const label = state.primaryError
    ? `${state.primaryError.label} issue`
    : state.tone === 'ok' && state.lastAnySuccessAt
      ? `Sync OK · ${new Date(state.lastAnySuccessAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : 'Sync unknown'

  const iconName =
    state.tone === 'error' ? 'alert-triangle' : state.tone === 'ok' ? 'check-circle' : 'minus-circle'
  const iconColor =
    state.tone === 'error' ? '#f87171' : state.tone === 'ok' ? '#34d399' : colors.mutedForeground
  const bg =
    state.tone === 'error' ? 'rgba(185,28,28,0.18)' : colors.card
  const border =
    state.tone === 'error' ? 'rgba(185,28,28,0.45)' : colors.border

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/audit' as never)}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <Feather name={iconName} size={14} color={iconColor} />
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
