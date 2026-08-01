import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'
import {
  cockpitQueryKey,
  cockpitRange,
  fetchCockpitLive,
  pickFitnessFreshness,
  verdictColor,
  type CockpitWindowDays,
} from '@/lib/cockpitWindow'
import { FitnessFreshnessStrip } from '@/components/FitnessFreshnessStrip'

const ACCENT = '#38bdf8'

type LabsSummary = {
  present?: boolean
  chipLabel?: string
  flaggedCount?: number
  drawDate?: string | null
}

export function EngineReadCard({ defaultDays = 7 }: { defaultDays?: CockpitWindowDays }) {
  const colors = useColors()
  const router = useRouter()
  const enabled = isPensApiConfigured()
  const [days, setDays] = useState<CockpitWindowDays>(defaultDays)
  const range = cockpitRange(days)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: cockpitQueryKey(range.from, range.to),
    enabled,
    queryFn: () => fetchCockpitLive(range.from, range.to),
  })

  const labsQ = useQuery({
    queryKey: ['bloodwork-latest-summary'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<LabsSummary | null> => {
      const res = await pensFetch('/api/bloodwork/latest-summary')
      if (!res.ok) return null
      return (await res.json()) as LabsSummary
    },
  })

  if (!enabled) return null

  const read = data?.cockpit?.theRead
  const inv = data?.cockpit?.inventory
  const note = data?.cockpit?.loadNotes?.[0]
  const rhr = data?.cockpit?.causal?.rhrLadder
  const fitness = pickFitnessFreshness(data?.cockpit)

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: ACCENT }]}>The Read</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Rolling {range.from} → {range.to}
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
        <View style={{ marginVertical: 12, gap: 8 }}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Loading cockpit… if this hangs, Next may be wedged — check /api/health.
          </Text>
        </View>
      ) : read ? (
        <>
          <View style={styles.verdictRow}>
            {read.verdict &&
            read.avgForm != null &&
            (read.avgFormInputs == null || read.avgFormInputs >= 2) ? (
              <View style={[styles.badge, { backgroundColor: `${verdictColor(read.verdict)}22` }]}>
                <Text style={{ color: verdictColor(read.verdict), fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                  {read.verdict}
                  {` · Form ${read.avgForm}`}
                  {read.avgFormInputs != null
                    ? ` · ${Math.round(read.avgFormInputs)} of ${read.formSignalCount ?? 5} signals`
                    : ''}
                </Text>
              </View>
            ) : read.verdict ? (
              <View style={[styles.badge, { backgroundColor: `${verdictColor(read.verdict)}22` }]}>
                <Text style={{ color: verdictColor(read.verdict), fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                  {read.verdict}
                </Text>
              </View>
            ) : (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                {read.avgFormInputs != null && read.avgFormInputs < 2
                  ? 'Form thin — fewer than 2 signals'
                  : 'No Form score in this window'}
              </Text>
            )}
          </View>
          {read.headline ? (
            <Text style={[styles.headline, { color: colors.foreground }]}>{read.headline}</Text>
          ) : null}
          <FitnessFreshnessStrip fitness={fitness} compact />
          <View style={styles.lines}>
            {read.leadingCause ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Cause · </Text>
                {read.leadingCause.label} ({Math.round(read.leadingCause.confidence * 100)}%)
              </Text>
            ) : null}
            {read.topRisk &&
            read.topRisk.replace(/\s*\(\d+%\)\s*$/, '').trim() !==
              (read.leadingCause?.label ?? '') ? (
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
            {rhr &&
            read.leadingCause?.id?.startsWith('rhr_') &&
            ((rhr.likelyDrinkingDays || 0) > 0 || (rhr.heavyStackDays || 0) > 0) ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#f87171' }}>RHR · </Text>
                {rhr.likelyDrinkingDays}d ≥50 · {rhr.heavyStackDays || 0}d ≥55
              </Text>
            ) : null}
            {labsQ.data?.present ? (
              <Pressable onPress={() => router.push('/bloodwork' as never)} hitSlop={8}>
                <Text
                  style={[
                    styles.body,
                    {
                      color: (labsQ.data.flaggedCount ?? 0) > 0 ? '#c4b5fd' : colors.mutedForeground,
                      textDecorationLine: 'underline',
                    },
                  ]}
                >
                  Labs · {labsQ.data.chipLabel}
                </Text>
              </Pressable>
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
