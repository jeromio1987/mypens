import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

type ActItem = {
  alreadyImported?: boolean
  name?: string
  exercise?: string
  date?: string
  externalId?: string
  sets?: number
  reps?: number
  weightKg?: number
  notes?: string
  calories?: number | null
  externalUrl?: string
  externalRaw?: string
}

/**
 * Banner when Garmin/Strava have recent activities not yet in the Training log.
 * Expands in place with Import all — no dead-end re-push to Training.
 */
export function OrphanActivitiesBanner() {
  const colors = useColors()
  const qc = useQueryClient()
  const enabled = isPensApiConfigured()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity-orphans'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [gRes, sRes] = await Promise.all([
        pensFetch('/api/integrations/garmin/activities?days=14'),
        pensFetch('/api/integrations/strava/activities?days=14'),
      ])
      let garmin: ActItem[] = []
      let strava: ActItem[] = []
      if (gRes.ok) {
        const j = (await gRes.json()) as { items?: ActItem[] }
        garmin = (j.items ?? []).filter((i) => !i.alreadyImported)
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { items?: ActItem[] }
        strava = (j.items ?? []).filter((i) => !i.alreadyImported)
      }
      return {
        garmin,
        strava,
        total: garmin.length + strava.length,
      }
    },
  })

  async function importAll() {
    if (!data) return
    setBusy(true)
    setStatus(null)
    try {
      const parts: string[] = []
      if (data.garmin.length) {
        const res = await pensFetch('/api/integrations/garmin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: data.garmin }),
        })
        const j = (await res.json().catch(() => ({}))) as {
          created?: number
          error?: string
        }
        if (!res.ok) parts.push(`Garmin: ${j.error ?? res.status}`)
        else parts.push(`Garmin: imported ${j.created ?? 0}`)
      }
      if (data.strava.length) {
        const res = await pensFetch('/api/integrations/strava/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: data.strava }),
        })
        const j = (await res.json().catch(() => ({}))) as {
          created?: number
          error?: string
        }
        if (!res.ok) parts.push(`Strava: ${j.error ?? res.status}`)
        else parts.push(`Strava: imported ${j.created ?? 0}`)
      }
      setStatus(parts.join(' · ') || 'Done')
      void qc.invalidateQueries({ queryKey: ['activity-orphans'] })
      void qc.invalidateQueries({ queryKey: ['training'] })
      void qc.invalidateQueries({ queryKey: ['energy'] })
      void refetch()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled || isLoading || !data || data.total === 0) {
    return null
  }

  const preview = [...data.garmin, ...data.strava].slice(0, 5)

  return (
    <View style={[styles.wrap, { borderColor: colors.warning, backgroundColor: 'rgba(245,158,11,0.12)' }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.card}>
        <Feather name="alert-circle" size={18} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {data.total} activit{data.total === 1 ? 'y' : 'ies'} not in Training log
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {[
              data.garmin.length ? `Garmin ${data.garmin.length}` : null,
              data.strava.length ? `Strava ${data.strava.length}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {' — tap to import'}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {preview.map((item, i) => (
            <Text
              key={`${item.externalId ?? item.exercise ?? item.name ?? i}`}
              style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}
            >
              {(item.date ?? '').slice(5)} · {item.exercise ?? item.name ?? 'Activity'}
              {item.calories ? ` · ${item.calories} kcal` : ''}
            </Text>
          ))}
          {data.total > preview.length ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 8 }}>
              +{data.total - preview.length} more
            </Text>
          ) : null}
          <Pressable
            onPress={() => void importAll()}
            disabled={busy}
            style={[styles.btn, { backgroundColor: colors.warning, opacity: busy ? 0.6 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Import all into Training</Text>
            )}
          </Pressable>
          {status ? (
            <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 8 }}>{status}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  card: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  btn: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
})
