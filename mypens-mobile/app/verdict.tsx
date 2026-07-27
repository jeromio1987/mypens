import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'

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

type Pillar = {
  key: string
  label: string
  score: number | null
  comment: string
  hasData: boolean
}

type LedgerItem = {
  date: string
  label: string
  points: number
  pillar: string
  detail: string
}

type VerdictData = {
  headline: string
  pillars: Pillar[]
  ledger: LedgerItem[]
  auditorNote: { quote: string; body: string } | string
  weekRange: string
  todayMode: string | null
  hasEnoughData: boolean
  modeNote: string | null
  window?: { label: 'rolling'; from: string; to: string; days: number }
}

async function fetchVerdict(): Promise<VerdictData> {
  const res = await pensFetch('/api/verdict')
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Verdict ${res.status}`)
  }
  return (await res.json()) as VerdictData
}

export default function VerdictScreen() {
  const configured = isPensApiConfigured()
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['verdict'],
    enabled: configured,
    queryFn: fetchVerdict,
  })

  return (
    <ContinentalScreen
      eyebrow="Week reconciliation"
      title="The Auditor's Verdict"
      subtitle={data?.weekRange ?? 'P.E.N.S. pillar ledger'}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      <ApiGate configured={configured}>
        {isLoading && !data ? <LoadingBlock /> : null}
        {error ? <EmptyHint>{(error as Error).message}</EmptyHint> : null}
        {data ? (
          <>
            <Block elevated>
              <Text style={styles.quote}>{data.headline}</Text>
              {data.modeNote ? <Text style={styles.mode}>{data.modeNote}</Text> : null}
            </Block>

            <SectionLabel>P.E.N.S. scores</SectionLabel>
            <View style={styles.chipGrid}>
              {data.pillars.map(p => (
                <MetricChip
                  key={p.key}
                  label={p.label}
                  value={p.hasData && p.score != null ? String(p.score) : '—'}
                  critical={p.hasData && p.score != null && p.score < 40}
                />
              ))}
            </View>

            {data.pillars.map(p =>
              p.comment ? (
                <Block key={`c-${p.key}`}>
                  <Text style={styles.pillarName}>{p.label}</Text>
                  <Text style={styles.comment}>{p.comment}</Text>
                </Block>
              ) : null,
            )}

            <SectionLabel>Ledger</SectionLabel>
            {data.ledger.length === 0 ? (
              <EmptyHint>No ledger lines this week.</EmptyHint>
            ) : (
              data.ledger.map((row, i) => (
                <Block key={`${row.date}-${i}`}>
                  <View style={styles.ledgerTop}>
                    <Text style={styles.ledgerDate}>{row.date}</Text>
                    <Text
                      style={[
                        styles.points,
                        { color: row.points >= 0 ? C.cream : C.oxblood },
                      ]}
                    >
                      {row.points >= 0 ? `+${row.points}` : row.points}
                    </Text>
                  </View>
                  <Text style={styles.ledgerLabel}>{row.label}</Text>
                  <Text style={styles.ledgerDetail}>
                    {row.pillar} · {row.detail}
                  </Text>
                </Block>
              ))
            )}

            <SectionLabel>Auditor note</SectionLabel>
            <Block elevated>
              {typeof data.auditorNote === 'string' ? (
                <Text style={styles.comment}>{data.auditorNote}</Text>
              ) : (
                <>
                  <Text style={styles.quote}>{data.auditorNote.quote}</Text>
                  <Text style={[styles.comment, { marginTop: 8 }]}>{data.auditorNote.body}</Text>
                </>
              )}
            </Block>

            <PrimaryButton label="Acknowledge debt" onPress={() => void refetch()} />
          </>
        ) : null}
      </ApiGate>
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  quote: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 22,
    lineHeight: 28,
  },
  mode: {
    color: C.creamMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillarName: {
    color: C.oxblood,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  comment: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  ledgerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerDate: {
    color: C.creamDim,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
  },
  ledgerLabel: {
    color: C.cream,
    fontSize: 15,
    fontFamily: C.fonts.display,
  },
  ledgerDetail: {
    color: C.creamMuted,
    fontSize: 12,
  },
})
