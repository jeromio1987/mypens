import React from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ApiGate,
  Block,
  ContinentalScreen,
  EmptyHint,
  LoadingBlock,
  MetricChip,
  PrimaryButton,
  SectionLabel,
} from '@/components/continental'
import { continental as C } from '@/constants/continental'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

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
  weekOf: string
  goal: { id?: string; label?: string; kind?: string } | null
  plan: {
    weekOf: string
    notes?: string[]
    days?: DayPlan[]
    goal?: { label?: string }
  }
  saved: { id: string; accepted: boolean; createdAt: string } | null
}

function intensityTone(intensity: string): string {
  switch (intensity) {
    case 'long':
      return C.cream
    case 'quality':
      return C.oxblood
    case 'strength':
      return '#B8A4FF'
    case 'easy':
      return '#9BC4A0'
    default:
      return C.creamMuted
  }
}

export default function PlannerScreen() {
  const configured = isPensApiConfigured()
  const qc = useQueryClient()

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['planner-full'],
    enabled: configured,
    queryFn: async (): Promise<PlannerResponse> => {
      const res = await pensFetch('/api/planner')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Planner ${res.status}`)
      }
      return (await res.json()) as PlannerResponse
    },
  })

  const accept = useMutation({
    mutationFn: async () => {
      if (!data?.plan) throw new Error('No plan')
      const res = await pensFetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_week',
          weekOf: data.weekOf,
          goalId: data.goal?.id ?? null,
          plan: data.plan,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Accept ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['planner-full'] })
      void qc.invalidateQueries({ queryKey: ['planner-week'] })
      Alert.alert('Confirmed', 'Week accepted.')
    },
    onError: (e: Error) => Alert.alert('System error', e.message),
  })

  const days = data?.plan?.days ?? []
  const notes = data?.plan?.notes ?? []
  const accepted = Boolean(data?.saved?.accepted)

  return (
    <ContinentalScreen
      eyebrow="Operational directive"
      title="Planner"
      subtitle={data?.weekOf ? `Week of ${data.weekOf}` : 'Adaptive week engine'}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      <ApiGate configured={configured}>
        {isLoading && !data ? <LoadingBlock /> : null}
        {error ? <EmptyHint>{(error as Error).message}</EmptyHint> : null}

        {data ? (
          <>
            <View style={styles.chipGrid}>
              <MetricChip
                label="Goal"
                value={(data.goal?.label || data.plan?.goal?.label || 'General').slice(0, 18)}
              />
              <MetricChip label="Status" value={accepted ? 'Accepted' : 'Draft'} critical={!accepted} />
            </View>

            <SectionLabel>Timeline</SectionLabel>
            {days.map(d => (
              <Block key={d.date}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayWd}>{d.weekday}</Text>
                  <Text style={[styles.dayInt, { color: intensityTone(d.intensity) }]}>
                    {d.minutes > 0 ? `${d.minutes}m · ${d.intensity}` : d.intensity}
                  </Text>
                </View>
                <Text style={styles.dayTitle}>{d.sport ? d.title : 'Rest / recovery'}</Text>
                {d.why ? <Text style={styles.dayWhy}>{d.why}</Text> : null}
              </Block>
            ))}

            {notes.length > 0 ? (
              <>
                <SectionLabel>Notes</SectionLabel>
                <Block elevated>
                  {notes.map((n, i) => (
                    <Text key={i} style={styles.note}>
                      · {n}
                    </Text>
                  ))}
                </Block>
              </>
            ) : null}

            <PrimaryButton
              label={accepted ? 'Week accepted' : accept.isPending ? 'Saving…' : 'Execute schedule'}
              onPress={() => void accept.mutate()}
              disabled={accepted || accept.isPending || days.length === 0}
            />
          </>
        ) : null}
      </ApiGate>
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayWd: {
    color: C.creamDim,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  dayInt: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayTitle: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 18,
  },
  dayWhy: {
    color: C.creamMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  note: {
    color: C.cream,
    fontSize: 13,
    lineHeight: 18,
  },
})
