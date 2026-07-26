import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

type ActItem = { alreadyImported?: boolean; name?: string; date?: string }

/** Banner when Garmin/Strava have recent activities not yet in the Training log. */
export function OrphanActivitiesBanner() {
  const colors = useColors()
  const router = useRouter()
  const enabled = isPensApiConfigured()

  const { data, isLoading } = useQuery({
    queryKey: ['activity-orphans'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [gRes, sRes] = await Promise.all([
        pensFetch('/api/integrations/garmin/activities?days=14'),
        pensFetch('/api/integrations/strava/activities?days=14'),
      ])
      let garminPending = 0
      let stravaPending = 0
      if (gRes.ok) {
        const j = (await gRes.json()) as { items?: ActItem[] }
        garminPending = (j.items ?? []).filter(i => !i.alreadyImported).length
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { items?: ActItem[] }
        stravaPending = (j.items ?? []).filter(i => !i.alreadyImported).length
      }
      return { garminPending, stravaPending, total: garminPending + stravaPending }
    },
  })

  if (!enabled || isLoading || !data || data.total === 0) {
    if (!enabled || !isLoading) return null
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/training' as never)}
      style={[styles.card, { borderColor: colors.warning, backgroundColor: 'rgba(245,158,11,0.12)' }]}
    >
      <Feather name="alert-circle" size={18} color={colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {data.total} activit{data.total === 1 ? 'y' : 'ies'} not in Training log
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {[
            data.garminPending ? `Garmin ${data.garminPending}` : null,
            data.stravaPending ? `Strava ${data.stravaPending}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {' — open Training to review'}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
})
