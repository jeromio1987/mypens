import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'

import {
  ApiGate,
  Block,
  ContinentalScreen,
  EmptyHint,
  LoadingBlock,
  MetricChip,
  SectionLabel,
} from '@/components/continental'
import { continental as C } from '@/constants/continental'
import {
  cockpitRange,
  summarizeTraining,
  verdictColor,
  type CockpitWindowDays,
  type PeriodReviewLiveResponse,
} from '@/lib/cockpitWindow'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

export default function PeriodReviewScreen() {
  const configured = isPensApiConfigured()
  const [days, setDays] = useState<CockpitWindowDays>(30)

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['period-review-live', days],
    enabled: configured,
    queryFn: async (): Promise<PeriodReviewLiveResponse> => {
      const { from, to } = cockpitRange(days)
      const res = await pensFetch(
        `/api/period-review?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Period review ${res.status}`)
      }
      return (await res.json()) as PeriodReviewLiveResponse
    },
  })

  const cockpit = data?.cockpit
  const read = cockpit?.theRead
  const series = cockpit?.series ?? []
  const train = summarizeTraining(series)
  const avgSleep =
    series.filter(d => d.sleepHours != null).length > 0
      ? series.reduce((a, d) => a + (d.sleepHours || 0), 0) /
        series.filter(d => d.sleepHours != null).length
      : null

  return (
    <ContinentalScreen
      eyebrow="Cyclical reconciliation"
      title="Period review"
      subtitle="Live cockpit — training, sleep, form. Not a hormonal mock."
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      <ApiGate configured={configured}>
        <SectionLabel>Window</SectionLabel>
        <View style={styles.row}>
          {([7, 30, 90] as CockpitWindowDays[]).map(d => (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              style={[styles.pick, days === d && styles.pickOn]}
            >
              <Text style={[styles.pickText, days === d && styles.pickTextOn]}>{d}d</Text>
            </Pressable>
          ))}
        </View>

        {isLoading && !data ? <LoadingBlock /> : null}
        {error ? <EmptyHint>{(error as Error).message}</EmptyHint> : null}

        {cockpit && read ? (
          <>
            <Block elevated>
              <Text style={styles.headline}>{read.headline || 'No headline'}</Text>
              <Text style={[styles.verdict, { color: verdictColor(read.verdict) }]}>
                {(read.verdict ?? 'unknown').toUpperCase()}
                {read.avgForm != null ? ` · form ${Math.round(read.avgForm)}` : ''}
              </Text>
              {read.nextAction ? <Text style={styles.next}>{read.nextAction}</Text> : null}
            </Block>

            <View style={styles.chipGrid}>
              <MetricChip label="Active days" value={String(train.activeDays)} />
              <MetricChip label="Load PLU" value={String(train.totalPlu)} />
              <MetricChip label="Hard PLU" value={String(train.hardPlu)} critical={train.hardPlu > train.easyPlu * 2} />
              <MetricChip
                label="Avg sleep"
                value={avgSleep != null ? `${avgSleep.toFixed(1)}h` : '—'}
                critical={avgSleep != null && avgSleep < 6.5}
              />
            </View>

            <SectionLabel>Inventory</SectionLabel>
            <Block>
              <Text style={styles.meta}>
                Nights {cockpit.inventory?.nights ?? '—'} · Activities{' '}
                {cockpit.inventory?.activities ?? '—'} · Trainings{' '}
                {cockpit.inventory?.trainings ?? '—'} · Days {cockpit.inventory?.days ?? series.length}
              </Text>
              {read.leadingCause ? (
                <Text style={styles.meta}>
                  Leading cause: {read.leadingCause.label} (
                  {Math.round(read.leadingCause.confidence * 100)}%)
                </Text>
              ) : null}
              {read.topRisk ? <Text style={styles.risk}>Risk: {read.topRisk}</Text> : null}
              {read.topWin ? <Text style={styles.win}>Win: {read.topWin}</Text> : null}
            </Block>

            {cockpit.causal?.narrative ? (
              <>
                <SectionLabel>Narrative</SectionLabel>
                <Block elevated>
                  <Text style={styles.body}>{cockpit.causal.narrative}</Text>
                </Block>
              </>
            ) : null}

            {(cockpit.loadNotes?.length ?? 0) > 0 ? (
              <>
                <SectionLabel>Load notes</SectionLabel>
                <Block>
                  {cockpit.loadNotes!.map((n, i) => (
                    <Text key={i} style={styles.meta}>
                      · {n}
                    </Text>
                  ))}
                </Block>
              </>
            ) : null}
          </>
        ) : null}
      </ApiGate>
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pick: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickOn: { backgroundColor: C.cream },
  pickText: {
    color: C.cream,
    fontWeight: '700',
    letterSpacing: 1,
    fontSize: 12,
  },
  pickTextOn: { color: C.onPrimary },
  headline: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 22,
    lineHeight: 28,
  },
  verdict: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  next: {
    color: C.creamMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  meta: {
    color: C.creamMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  risk: {
    color: C.oxblood,
    fontSize: 13,
    marginTop: 6,
  },
  win: {
    color: C.cream,
    fontSize: 13,
    marginTop: 4,
  },
  body: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
  },
})
