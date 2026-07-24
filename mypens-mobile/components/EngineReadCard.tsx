import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'
import {
  cockpitRange,
  verdictColor,
  type CockpitWindowDays,
  type PeriodReviewLiveResponse,
} from '@/lib/cockpitWindow'

const ACCENT = '#38bdf8'

export function EngineReadCard({ defaultDays = 7 }: { defaultDays?: CockpitWindowDays }) {
  const colors = useColors()
  const enabled = isPensApiConfigured()
  const [days, setDays] = useState<CockpitWindowDays>(defaultDays)
  const range = cockpitRange(days)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['period-review-live', range.from, range.to],
    enabled,
    queryFn: async (): Promise<PeriodReviewLiveResponse> => {
      const res = await pensFetch(
        `/api/period-review?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Period review ${res.status}`)
      }
      return (await res.json()) as PeriodReviewLiveResponse
    },
  })

  if (!enabled) return null

  const read = data?.cockpit?.theRead
  const inv = data?.cockpit?.inventory
  const note = data?.cockpit?.loadNotes?.[0]
  const rhr = data?.cockpit?.causal?.rhrLadder

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: ACCENT }]}>The Read</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {range.from} → {range.to}
          </Text>
        </View>
        <Pressable onPress={() => void refetch()} hitSlop={10} disabled={isRefetching}>
          {isRefetching || isLoading ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {([7, 30, 90] as CockpitWindowDays[]).map(d => (
          <Pressable
            key={d}
            onPress={() => setDays(d)}
            style={[
              styles.chip,
              {
                backgroundColor: days === d ? ACCENT : colors.secondary,
                borderColor: days === d ? ACCENT : colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: days === d ? '#0c1a2e' : colors.mutedForeground,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12,
              }}
            >
              {d}d
            </Text>
          </Pressable>
        ))}
      </View>

      {isError ? (
        <Text style={[styles.body, { color: colors.warning }]}>
          {(error as Error)?.message ?? 'Could not load The Read'}
        </Text>
      ) : isLoading && !data ? (
        <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
      ) : read ? (
        <>
          <View style={styles.verdictRow}>
            {read.verdict ? (
              <View style={[styles.badge, { backgroundColor: `${verdictColor(read.verdict)}22` }]}>
                <Text style={{ color: verdictColor(read.verdict), fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                  {read.verdict}
                  {read.avgForm != null ? ` · Form ${read.avgForm}` : ''}
                </Text>
              </View>
            ) : (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>No Form score in this window</Text>
            )}
          </View>
          {read.headline ? (
            <Text style={[styles.headline, { color: colors.foreground }]}>{read.headline}</Text>
          ) : null}
          <View style={styles.lines}>
            {read.leadingCause ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Cause · </Text>
                {read.leadingCause.label} ({Math.round(read.leadingCause.confidence * 100)}%)
              </Text>
            ) : null}
            {read.topRisk ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fbbf24' }}>Risk · </Text>
                {read.topRisk}
              </Text>
            ) : null}
            {read.topWin ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#34d399' }}>Win · </Text>
                {read.topWin}
              </Text>
            ) : null}
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: ACCENT }}>Next · </Text>
              {read.nextAction}
            </Text>
            {rhr && (rhr.likelyDrinkingDays || 0) > 0 ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#f87171' }}>RHR · </Text>
                {rhr.likelyDrinkingDays}d ≥50 · {rhr.heavyStackDays || 0}d ≥55
              </Text>
            ) : null}
          </View>
          {inv ? (
            <View style={styles.invRow}>
              {[
                ['Nights', inv.nights],
                ['Garmin', inv.activities],
                ['Train', inv.trainings],
                ['Days', inv.days],
              ].map(([k, v]) => (
                <View key={String(k)} style={[styles.invCell, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.invLabel, { color: colors.mutedForeground }]}>{k}</Text>
                  <Text style={[styles.invVal, { color: colors.foreground }]}>{v ?? '—'}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {note ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]} numberOfLines={3}>
              {note}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>No cockpit data for this window.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  verdictRow: { marginBottom: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  headline: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  lines: { gap: 8 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  invRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  invCell: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6 },
  invLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  invVal: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 10, lineHeight: 15 },
})
