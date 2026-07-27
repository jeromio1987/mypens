import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'

import { EngineReadCard } from '@/components/EngineReadCard'
import { SyncChip } from '@/components/SyncChip'
import { continental as C } from '@/constants/continental'
import { DESTINATIONS } from '@/lib/destinations'

/** WP 1.5 / 3.3 — Read destination: Continental surfaces. */
export default function ReadTabScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const blurb = DESTINATIONS.find(d => d.id === 'read')!.blurb

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Text style={styles.kicker}>The Continental · P.E.N.S.</Text>
      <Text style={styles.title}>Read</Text>
      <Text style={styles.sub}>{blurb}</Text>

      <SyncChip />
      <EngineReadCard defaultDays={7} />

      <View style={styles.row}>
        <Pressable style={styles.linkCard} onPress={() => router.push('/period-review' as never)}>
          <Feather name="activity" size={16} color={C.cream} />
          <Text style={styles.linkText}>Full cockpit</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => router.push('/(tabs)/index' as never)}>
          <Feather name="trending-up" size={16} color={C.cream} />
          <Text style={styles.linkText}>Weight trend</Text>
        </Pressable>
        <Pressable style={styles.linkCard} onPress={() => router.push('/(tabs)/sleep' as never)}>
          <Feather name="moon" size={16} color={C.cream} />
          <Text style={styles.linkText}>Sleep trend</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: C.creamDim,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: C.cream,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 4,
    color: C.creamMuted,
  },
  row: {
    gap: 8,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surfaceHigh,
    borderRadius: C.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  linkText: {
    color: C.cream,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
})
