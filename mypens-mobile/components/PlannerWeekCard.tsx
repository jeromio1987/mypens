import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

const MOD = MODULE_COLORS.training

type DayPlan = {
  date: string
  weekday: string
  sport: string | null
  intensity: string
  minutes: number
  title: string
  why: string
  isLong: boolean
}

type PlannerResponse = {
  plan?: {
    weekOf: string
    notes?: string[]
    days?: DayPlan[]
    goal?: { label?: string }
  }
}

function intensityColor(intensity: string, colors: ReturnType<typeof useColors>) {
  switch (intensity) {
    case 'long':
      return MOD.primary
    case 'quality':
      return '#ef4444'
    case 'strength':
      return '#8b5cf6'
    case 'easy':
      return '#22c55e'
    default:
      return colors.mutedForeground
  }
}

export function PlannerWeekCard() {
  const colors = useColors()
  const enabled = isPensApiConfigured()

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['planner-week'],
    enabled,
    queryFn: async (): Promise<PlannerResponse> => {
      const res = await pensFetch('/api/planner')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Planner ${res.status}`)
      }
      return (await res.json()) as PlannerResponse
    },
  })

  if (!enabled) return null

  const days = data?.plan?.days ?? []
  const notes = data?.plan?.notes ?? []
  const goalLabel = data?.plan?.goal?.label
  const foodNote = notes.find(n => /fuel|kcal|protein/i.test(n))

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>This week</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {goalLabel ? goalLabel : 'Adaptive planner'} · read-only
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

      {isError ? (
        <Text style={[styles.sub, { color: colors.warning }]}>
          {(error as Error)?.message ?? 'Could not load plan'}
        </Text>
      ) : isLoading && !data ? (
        <ActivityIndicator color={MOD.primary} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <View style={styles.dayGrid}>
            {days.map(d => {
              const accent = intensityColor(d.intensity, colors)
              return (
                <View
                  key={d.date}
                  style={[
                    styles.dayCell,
                    {
                      borderColor: d.isLong ? MOD.primary : colors.border,
                      backgroundColor: colors.secondary,
                    },
                  ]}
                >
                  <Text style={[styles.dayWd, { color: colors.mutedForeground }]}>
                    {d.weekday.slice(0, 3)}
                  </Text>
                  <Text style={[styles.dayTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {d.sport ? d.title : 'Rest'}
                  </Text>
                  <Text style={[styles.dayMeta, { color: accent }]}>
                    {d.minutes > 0 ? `${d.minutes}m · ${d.intensity}` : d.intensity}
                  </Text>
                  {/Fueling logged:/i.test(d.why) ? (
                    <Text style={[styles.dayFuel, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {d.why.match(/Fueling logged:[^.]+/i)?.[0] ?? 'Fueling logged'}
                    </Text>
                  ) : null}
                </View>
              )
            })}
          </View>
          {foodNote ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]} numberOfLines={3}>
              {foodNote}
            </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCell: {
    width: '31.5%',
    minWidth: 96,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    minHeight: 78,
  },
  dayWd: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 4,
    flex: 1,
  },
  dayMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 4,
  },
  dayFuel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    marginTop: 3,
    lineHeight: 12,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 15,
  },
})
