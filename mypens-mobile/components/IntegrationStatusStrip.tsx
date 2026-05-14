import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { pensFetch, isPensApiConfigured } from '@/lib/pensApi'
import { useColors } from '@/hooks/useColors'

type Provider = 'strava' | 'garmin' | 'healthkit' | 'healthconnect'

type Status = {
  connected: boolean
  lastSyncAt?: string | null
  webhookActive?: boolean
  lastError?: string | null
  stale?: boolean
}

const PATH: Record<Provider, string> = {
  strava: '/api/integrations/strava/status',
  garmin: '/api/integrations/garmin/status',
  healthkit: '/api/integrations/healthkit/status',
  healthconnect: '/api/integrations/healthconnect/status',
}

const LABEL: Record<Provider, string> = {
  strava: 'Strava',
  garmin: 'Garmin',
  healthkit: 'Health',
  healthconnect: 'H.Connect',
}

export function IntegrationStatusStrip({ onPress }: { onPress?: () => void }) {
  const colors = useColors()
  const [row, setRow] = useState<Partial<Record<Provider, Status>>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isPensApiConfigured()) return
    let cancelled = false
    void (async () => {
      try {
        const entries = await Promise.all(
          (Object.keys(PATH) as Provider[]).map(async (p) => {
            const r = await pensFetch(PATH[p])
            const j = (await r.json().catch(() => ({}))) as Status & { error?: string }
            if (!r.ok) return [p, null] as const
            return [p, j] as const
          }),
        )
        if (cancelled) return
        const next: Partial<Record<Provider, Status>> = {}
        for (const [p, j] of entries) {
          if (j) next[p] = j
        }
        setRow(next)
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'status')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isPensApiConfigured()) return null

  const Inner = (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>Integrations</Text>
      {err ? <Text style={{ color: colors.destructive, fontSize: 11 }}>{err}</Text> : null}
      <View style={styles.row}>
        {(Object.keys(PATH) as Provider[]).map((p) => {
          const s = row[p]
          const ok = Boolean(s?.connected)
          const wh = p === 'strava' && s?.webhookActive
          return (
            <View key={p} style={styles.chip}>
              <View style={[styles.dot, { backgroundColor: ok ? '#34d399' : colors.border }]} />
              <Text style={[styles.chipLabel, { color: colors.foreground }]}>{LABEL[p]}</Text>
              {wh ? <Text style={{ fontSize: 9, color: colors.mutedForeground }}>hook</Text> : null}
            </View>
          )
        })}
      </View>
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.outer}>
        {Inner}
      </Pressable>
    )
  }
  return <View style={styles.outer}>{Inner}</View>
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: 16, marginBottom: 12 },
  wrap: { borderRadius: 12, borderWidth: 1, padding: 10 },
  title: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
})
