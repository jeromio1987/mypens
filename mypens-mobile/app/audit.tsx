import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'

import {
  ApiGate,
  Block,
  ContinentalScreen,
  MetricChip,
  SectionLabel,
} from '@/components/continental'
import { continental as C } from '@/constants/continental'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'
import { GarminPullCard } from '@/components/GarminPullCard'

const LINKS: {
  href: string
  label: string
  blurb: string
  icon: React.ComponentProps<typeof Feather>['name']
}[] = [
  { href: '/verdict', label: 'Verdict', blurb: 'Weekly P.E.N.S. reconciliation', icon: 'check-square' },
  { href: '/dopamine-debt', label: 'Dopamine debt', blurb: 'Liquidation protocol (shell)', icon: 'zap' },
  { href: '/bloodwork', label: 'Bloodwork', blurb: 'Serum ledger from lab panels', icon: 'droplet' },
  { href: '/planner', label: 'Planner', blurb: 'Operational week directive', icon: 'calendar' },
  { href: '/period-review', label: 'Period review', blurb: 'Live cockpit reconciliation', icon: 'activity' },
  { href: '/journal-log', label: 'Journal log', blurb: 'Auditor chronological feed', icon: 'book-open' },
]

export default function AuditHubScreen() {
  const router = useRouter()
  const configured = isPensApiConfigured()

  const verdictQ = useQuery({
    queryKey: ['audit-verdict-chip'],
    enabled: configured,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await pensFetch('/api/verdict')
      if (!res.ok) return null
      return (await res.json()) as {
        hasEnoughData?: boolean
        pillars?: { key: string; score: number }[]
        todayMode?: string | null
      }
    },
  })

  const plannerQ = useQuery({
    queryKey: ['audit-planner-chip'],
    enabled: configured,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await pensFetch('/api/planner')
      if (!res.ok) return null
      return (await res.json()) as {
        saved?: { accepted?: boolean } | null
        goal?: { label?: string } | null
      }
    },
  })

  const bloodQ = useQuery({
    queryKey: ['audit-blood-chip'],
    enabled: configured,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await pensFetch('/api/bloodwork/panels')
      if (!res.ok) return null
      const panels = (await res.json()) as { drawDate?: string }[]
      return panels[0]?.drawDate ?? null
    },
  })

  const pScore = (key: string) =>
    verdictQ.data?.pillars?.find(p => p.key === key)?.score

  return (
    <ContinentalScreen
      eyebrow="P.E.N.S. · The Continental"
      title="The Audit"
      subtitle="Commands, not cues. Open a ledger."
    >
      <ApiGate configured={configured}>
        <SectionLabel>Live status</SectionLabel>
        <View style={styles.chipGrid}>
          <MetricChip
            label="Perf"
            value={verdictQ.data?.hasEnoughData ? String(pScore('P') ?? '—') : '—'}
          />
          <MetricChip
            label="Sleep"
            value={verdictQ.data?.hasEnoughData ? String(pScore('S') ?? '—') : '—'}
          />
          <MetricChip
            label="Planner"
            value={plannerQ.data?.saved?.accepted ? 'Accepted' : 'Draft'}
            critical={!plannerQ.data?.saved?.accepted}
          />
          <MetricChip label="Last draw" value={bloodQ.data ?? 'None'} />
        </View>
        {verdictQ.data?.todayMode ? (
          <Block>
            <Text style={styles.note}>Mode today: {verdictQ.data.todayMode.replace('_', ' ')}</Text>
          </Block>
        ) : null}

        <GarminPullCard days={7} />

        <SectionLabel>Ledgers</SectionLabel>
        <View style={styles.list}>
          {LINKS.map(item => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={styles.row}
            >
              <View style={styles.iconWrap}>
                <Feather name={item.icon} size={18} color={C.cream} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.label}</Text>
                <Text style={styles.rowBlurb}>{item.blurb}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.creamDim} />
            </Pressable>
          ))}
        </View>
      </ApiGate>
      {!configured ? null : (
        <Block>
          <Text style={styles.note}>
            Existing capture tabs stay as they are. This hub is for reading the books.
          </Text>
        </Block>
      )}
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surfaceHigh,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    backgroundColor: C.surfaceLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: C.cream,
    fontSize: 16,
    fontFamily: C.fonts.display,
  },
  rowBlurb: {
    color: C.creamMuted,
    fontSize: 12,
    marginTop: 2,
  },
  note: {
    color: C.creamMuted,
    fontSize: 12,
    lineHeight: 17,
  },
})
