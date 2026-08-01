import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { BarChart } from 'react-native-gifted-charts'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { isPensApiConfigured } from '@/lib/pensApi'
import {
  TRAIN_COCKPIT_DAYS,
  cockpitQueryKey,
  fetchCockpitLive,
  pickFitnessFreshness,
  summarizeTraining,
} from '@/lib/cockpitWindow'
import { rollingWindow, shiftDateStr } from '@/lib/timeWindow'
import { FitnessFreshnessStrip } from '@/components/FitnessFreshnessStrip'

const MOD = MODULE_COLORS.training

function peakDayLabel(series: { date: string; trainingLoad: number }[], peak: number): string | null {
  if (peak <= 0) return null
  const hit = series.find(d => Math.round(d.trainingLoad || 0) === peak)
  if (!hit) return null
  const d = new Date(`${hit.date}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Fetches ~55d once (shared with Train load bars via cockpitQueryKey).
 * Chip 7/14/30 only slices the series client-side — no second network call.
 */
export function TrainingReviewCard({ defaultDays = 14 }: { defaultDays?: 7 | 14 | 30 }) {
  const colors = useColors()
  const { width } = useWindowDimensions()
  const enabled = isPensApiConfigured()
  const [days, setDays] = useState<7 | 14 | 30>(defaultDays)
  const [showPluHelp, setShowPluHelp] = useState(false)
  const { from: fetchFrom, to } = rollingWindow(TRAIN_COCKPIT_DAYS)
  const displayFrom = shiftDateStr(to, -(days - 1))
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: cockpitQueryKey(fetchFrom, to),
    enabled,
    queryFn: () => fetchCockpitLive(fetchFrom, to),
  })

  if (!enabled) return null

  const fullSeries = data?.cockpit?.series ?? []
  const series = fullSeries.filter(d => d.date >= displayFrom && d.date <= to)
  const sum = summarizeTraining(series)
  const fitness = pickFitnessFreshness(data?.cockpit)
  const peakLabel = peakDayLabel(series, sum.peak)
  const hardDays = series.filter(d => (d.hardLoad || 0) > (d.easyLoad || 0) && (d.trainingLoad || 0) > 0).length
  const chartW = width - 64
  const barData = series.slice(-14).map((d, i, arr) => ({
    value: Math.round(d.trainingLoad || 0),
    label: i === 0 || i === arr.length - 1 ? d.date.slice(5) : '',
    frontColor: (d.hardLoad || 0) > (d.easyLoad || 0) ? MOD.primary : `${MOD.primary}88`,
  }))

  const plain =
    sum.activeDays === 0
      ? `Last ${days} days: no training load logged. Recovery leans on sleep and resting HR.`
      : `Last ${days} days: ${sum.activeDays} active day${sum.activeDays === 1 ? '' : 's'}, of which ${hardDays} heavy. Heaviest day: ${peakLabel ?? '—'}.`

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MOD.primary }]}>Training review</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {displayFrom} → {to}
          </Text>
        </View>
        <Pressable onPress={() => setShowPluHelp(s => !s)} hitSlop={10} style={{ marginRight: 8 }}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={() => void refetch()} hitSlop={10} disabled={isRefetching}>
          {isRefetching || isLoading ? (
            <ActivityIndicator color={MOD.primary} size="small" />
          ) : (
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {([7, 14, 30] as const).map(d => (
          <Pressable
            key={d}
            onPress={() => setDays(d)}
            style={[
              styles.chip,
              {
                backgroundColor: days === d ? MOD.primary : colors.secondary,
                borderColor: days === d ? MOD.primary : colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: days === d ? '#fff' : colors.mutedForeground,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12,
              }}
            >
              {d}d
            </Text>
          </Pressable>
        ))}
      </View>

      {showPluHelp ? (
        <Text style={[styles.explain, { color: colors.mutedForeground, marginBottom: 8 }]}>
          Load ≈ minutes × sport × heart-rate intensity. Walks count light; strength/HIIT heavy.
          Internal unit is PLU — kept off the main screen.
        </Text>
      ) : null}

      {isError ? (
        <Text style={{ color: colors.warning, fontSize: 13 }}>{(error as Error)?.message}</Text>
      ) : isLoading && !data ? (
        <View style={{ marginVertical: 12, gap: 8 }}>
          <ActivityIndicator color={MOD.primary} />
          <Text style={[styles.explain, { color: colors.mutedForeground }]}>
            Loading cockpit… if this hangs, Next may be wedged — check /api/health.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.plain, { color: colors.foreground }]}>{plain}</Text>
          <FitnessFreshnessStrip fitness={fitness} compact />
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active days</Text>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{sum.activeDays}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Minutes</Text>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{sum.minutes}</Text>
            </View>
          </View>
          {barData.some(b => b.value > 0) ? (
            <View style={{ marginTop: 8 }}>
              <BarChart
                data={barData}
                width={chartW}
                height={110}
                barWidth={Math.max(8, chartW / Math.max(barData.length * 1.6, 1))}
                spacing={4}
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 9 }}
                xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 9 }}
                noOfSections={3}
                isAnimated={false}
              />
            </View>
          ) : null}
        </>
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
  stats: { flexDirection: 'row', gap: 6, marginTop: 10 },
  stat: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6 },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  statVal: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  plain: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  explain: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
})
