import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { BarChart } from 'react-native-gifted-charts'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'
import {
  isoToday,
  summarizeTraining,
  type PeriodReviewLiveResponse,
} from '@/lib/cockpitWindow'

const MOD = MODULE_COLORS.training

function rangeFor(days: 7 | 14 | 30): { from: string; to: string } {
  const to = isoToday()
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from, to }
}

export function TrainingReviewCard({ defaultDays = 14 }: { defaultDays?: 7 | 14 | 30 }) {
  const colors = useColors()
  const { width } = useWindowDimensions()
  const enabled = isPensApiConfigured()
  const [days, setDays] = useState<7 | 14 | 30>(defaultDays)
  const { from, to } = rangeFor(days)
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['period-review-training', from, to],
    enabled,
    queryFn: async (): Promise<PeriodReviewLiveResponse> => {
      const res = await pensFetch(
        `/api/period-review?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Training review ${res.status}`)
      }
      return (await res.json()) as PeriodReviewLiveResponse
    },
  })

  if (!enabled) return null

  const series = data?.cockpit?.series ?? []
  const sum = summarizeTraining(series)
  const chartW = width - 64
  const barData = series.slice(-14).map((d, i, arr) => ({
    value: Math.round(d.trainingLoad || 0),
    label: i === 0 || i === arr.length - 1 ? d.date.slice(5) : '',
    frontColor: (d.hardLoad || 0) > (d.easyLoad || 0) ? MOD.primary : `${MOD.primary}88`,
  }))

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MOD.primary }]}>Training review</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            PLU load · {from} → {to}
          </Text>
        </View>
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

      {isError ? (
        <Text style={{ color: colors.warning, fontSize: 13 }}>{(error as Error)?.message}</Text>
      ) : isLoading && !data ? (
        <ActivityIndicator color={MOD.primary} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <View style={styles.stats}>
            {[
              ['PLU', String(sum.totalPlu)],
              ['Active', String(sum.activeDays)],
              ['Hard', String(sum.hardPlu)],
              ['Peak', String(sum.peak)],
            ].map(([k, v]) => (
              <View key={k} style={[styles.stat, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{k}</Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{v}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.explain, { color: colors.mutedForeground }]}>
            {sum.activeDays === 0
              ? 'No training load in this window — Form leans on sleep / RHR more than sport.'
              : `${sum.activeDays} active day${sum.activeDays === 1 ? '' : 's'} · ${sum.minutes} raw minutes · easy PLU ${sum.easyPlu}. Same series as web /period-review Training.`}
          </Text>
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
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6 },
  statLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  statVal: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  explain: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 10 },
})
