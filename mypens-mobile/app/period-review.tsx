import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

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
  cockpitQueryKey,
  cockpitRange,
  fetchCockpitLive,
  pickFitnessFreshness,
  summarizeTraining,
  verdictColor,
  type CockpitWindowDays,
} from '@/lib/cockpitWindow'
import { isPensApiConfigured } from '@/lib/pensApi'
import { FitnessFreshnessStrip } from '@/components/FitnessFreshnessStrip'

export default function PeriodReviewScreen() {
  const configured = isPensApiConfigured()
  const [days, setDays] = useState<CockpitWindowDays>(30)
  const [showLoadHelp, setShowLoadHelp] = useState(false)
  const range = cockpitRange(days)

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: cockpitQueryKey(range.from, range.to),
    enabled: configured,
    queryFn: () => fetchCockpitLive(range.from, range.to),
  })

  const cockpit = data?.cockpit
  const read = cockpit?.theRead
  const series = cockpit?.series ?? []
  const train = summarizeTraining(series)
  const fitness = pickFitnessFreshness(cockpit)
  const hardDays = series.filter(
    d => (d.hardLoad || 0) > (d.easyLoad || 0) && (d.trainingLoad || 0) > 0,
  ).length
  const avgSleep =
    series.filter(d => d.sleepHours != null).length > 0
      ? series.reduce((a, d) => a + (d.sleepHours || 0), 0) /
        series.filter(d => d.sleepHours != null).length
      : null

  const plain =
    train.activeDays === 0
      ? `Last ${days} days: no training load logged. Recovery leans on sleep and resting HR.`
      : `Last ${days} days: ${train.activeDays} active day${train.activeDays === 1 ? '' : 's'}, of which ${hardDays} heavy.`

  return (
    <ContinentalScreen
      eyebrow="Cyclical reconciliation"
      title="Period review"
      subtitle={`Rolling ${range.from} → ${range.to} · live cockpit`}
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
                {read.avgForm != null &&
                (read.avgFormInputs == null || read.avgFormInputs >= 2)
                  ? ` · form ${Math.round(read.avgForm)}${
                      read.avgFormInputs != null
                        ? ` · ${Math.round(read.avgFormInputs)} of ${read.formSignalCount ?? 5} signals`
                        : ''
                    }`
                  : ''}
              </Text>
              {read.nextAction ? <Text style={styles.next}>{read.nextAction}</Text> : null}
            </Block>

            <View style={styles.loadHeader}>
              <Text style={styles.plain}>{plain}</Text>
              <Pressable onPress={() => setShowLoadHelp(s => !s)} hitSlop={10}>
                <Feather name="info" size={16} color={C.creamMuted} />
              </Pressable>
            </View>
            {showLoadHelp ? (
              <Text style={styles.explain}>
                Load ≈ minutes × sport × heart-rate intensity. Walks count light; strength/HIIT
                heavy. Internal unit is PLU — kept off the main screen. “Load (relative)” is a
                relative total for the window, not a medical readiness score.
              </Text>
            ) : null}

            <View style={styles.chipGrid}>
              <MetricChip label="Active days" value={String(train.activeDays)} />
              <MetricChip label="Load (relative)" value={String(train.totalPlu)} />
              <MetricChip label="Heavy load (relative)" value={String(train.hardPlu)} />
              <MetricChip
                label="Avg sleep"
                value={avgSleep != null ? `${avgSleep.toFixed(1)}h` : '—'}
                critical={avgSleep != null && avgSleep < 6.5}
              />
            </View>

            {fitness ? (
              <>
                <SectionLabel>Training load form</SectionLabel>
                <Text style={[styles.meta, { marginBottom: 6 }]}>
                  Descriptive load model — not medical readiness, not the Form score.
                </Text>
                <Block>
                  <FitnessFreshnessStrip fitness={fitness} />
                </Block>
              </>
            ) : null}

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
              {read.topRisk &&
              read.topRisk.replace(/\s*\(\d+%\)\s*$/, '').trim() !==
                (read.leadingCause?.label ?? '') ? (
                <Text style={styles.risk}>Risk: {read.topRisk}</Text>
              ) : null}
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
  loadHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  plain: {
    flex: 1,
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  explain: {
    color: C.creamMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
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
    fontSize: 12,
    marginTop: 6,
  },
  win: {
    color: C.cream,
    fontSize: 12,
    marginTop: 4,
  },
  body: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
  },
})
