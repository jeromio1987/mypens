import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

type JournalEntry = {
  id: string
  date: string
  title?: string | null
  content: string
  mood?: number | null
  createdAt?: string
  voicePath?: string | null
}

function moodLabel(mood: number | null | undefined): string {
  if (mood == null) return '—'
  if (mood >= 4) return 'High'
  if (mood === 3) return 'Steady'
  return 'Low'
}

export default function JournalLogScreen() {
  const configured = isPensApiConfigured()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['journal-log'],
    enabled: configured,
    queryFn: async (): Promise<JournalEntry[]> => {
      const res = await pensFetch('/api/journal?limit=60')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Journal ${res.status}`)
      }
      const json = await res.json()
      const rows = Array.isArray(json) ? json : (json.entries ?? json.items ?? [])
      return rows as JournalEntry[]
    },
  })

  const entries = data ?? []
  const withMood = entries.filter(e => e.mood != null)
  const avgMood =
    withMood.length > 0
      ? withMood.reduce((a, e) => a + (e.mood || 0), 0) / withMood.length
      : null

  return (
    <View style={{ flex: 1 }}>
      <ContinentalScreen
        eyebrow="Auditor's log"
        title="Journal log"
        subtitle="Chronological feed. Capture stays on the Journal tab."
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <ApiGate configured={configured}>
          <View style={styles.chipGrid}>
            <MetricChip label="Entries" value={String(entries.length)} />
            <MetricChip
              label="Mean mood"
              value={avgMood != null ? avgMood.toFixed(1) : '—'}
            />
          </View>

          {isLoading && !data ? <LoadingBlock /> : null}
          {error ? <EmptyHint>{(error as Error).message}</EmptyHint> : null}
          {!isLoading && entries.length === 0 ? (
            <EmptyHint>No journal entries yet.</EmptyHint>
          ) : null}

          <SectionLabel>Feed</SectionLabel>
          {entries.map((e, idx) => {
            const elevated = (e.mood != null && e.mood <= 2) || idx === 0
            return (
              <Block key={e.id} elevated={elevated}>
                <View style={styles.head}>
                  <Text style={styles.date}>{e.date}</Text>
                  <Text style={[styles.mood, e.mood != null && e.mood <= 2 && { color: C.oxblood }]}>
                    Drift {moodLabel(e.mood)}
                    {e.mood != null ? ` (${e.mood}/5)` : ''}
                  </Text>
                </View>
                {e.title ? <Text style={styles.title}>{e.title}</Text> : null}
                  <Pressable
                    onPress={() => {
                      router.push(`/(tabs)/journal?date=${encodeURIComponent(e.date)}` as never)
                    }}
                  >
                    <Text style={styles.body} numberOfLines={6}>
                      {e.content || '—'}
                    </Text>
                  </Pressable>
                {e.voicePath ? (
                  <Text style={styles.voice}>Voice note on file</Text>
                ) : null}
              </Block>
            )
          })}
        </ApiGate>
      </ContinentalScreen>

      <Pressable
        onPress={() => {
          const d = entries[0]?.date
          if (d) router.push(`/(tabs)/journal?date=${encodeURIComponent(d)}` as never)
          else router.push('/(tabs)/journal' as never)
        }}
        style={[
          styles.fab,
          { bottom: (Platform.OS === 'web' ? 24 : insets.bottom + 16) },
        ]}
        accessibilityLabel="Open journal capture"
      >
        <Feather name="edit-3" size={22} color={C.onPrimary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    color: C.creamDim,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  mood: {
    color: C.creamMuted,
    fontSize: 11,
  },
  title: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 18,
  },
  body: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  voice: {
    color: C.oxblood,
    fontSize: 11,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    elevation: 4,
  },
})
