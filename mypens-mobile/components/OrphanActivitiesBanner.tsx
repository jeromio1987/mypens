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

/** True when stored exercise label is still a raw HC type stub. */
function isRawTypeLabel(label: string | null | undefined): boolean {
  if (!label) return false
  return /^(?:type[_\s-]*)?\d+$/i.test(label.trim()) || /^TYPE_\d+$/i.test(label.trim())
}

/**
 * Banner when Garmin/Strava/HC have recent activities not yet clean in Training.
 * Distinguishes already-known skips vs needs-label / incomplete HC stubs.
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
      const [gRes, sRes, hcRes] = await Promise.all([
        pensFetch('/api/integrations/garmin/activities?days=14'),
        pensFetch('/api/integrations/strava/activities?days=14'),
        pensFetch('/api/integrations/healthconnect/activities'),
      ])
      let garmin: ActItem[] = []
      let strava: ActItem[] = []
      let hcNeedsLabel: ActItem[] = []
      let hcPending: ActItem[] = []
      if (gRes.ok) {
        const j = (await gRes.json()) as { items?: ActItem[] }
        garmin = (j.items ?? []).filter(i => !i.alreadyImported)
      }
      if (sRes.ok) {
        const j = (await sRes.json()) as { items?: ActItem[] }
        strava = (j.items ?? []).filter(i => !i.alreadyImported)
      }
      if (hcRes.ok) {
        const j = (await hcRes.json()) as { items?: ActItem[] }
        const items = j.items ?? []
        hcNeedsLabel = items.filter(
          i => !i.alreadyImported && isRawTypeLabel(i.exercise ?? i.name),
        )
        hcPending = items.filter(
          i => !i.alreadyImported && !isRawTypeLabel(i.exercise ?? i.name),
        )
      }
      return {
        garmin,
        strava,
        hcNeedsLabel,
        hcPending,
        total: garmin.length + strava.length + hcNeedsLabel.length + hcPending.length,
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
      const hcItems = [...data.hcPending, ...data.hcNeedsLabel]
      if (hcItems.length) {
        const res = await pensFetch('/api/integrations/healthconnect/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: hcItems }),
        })
        const j = (await res.json().catch(() => ({}))) as {
          created?: number
          error?: string
        }
        if (!res.ok) parts.push(`HC: ${j.error ?? res.status}`)
        else parts.push(`HC: imported ${j.created ?? 0}`)
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

  const preview = [
    ...data.garmin,
    ...data.strava,
    ...data.hcPending,
    ...data.hcNeedsLabel,
  ].slice(0, 5)

  const subParts = [
    data.garmin.length ? `Garmin ${data.garmin.length}` : null,
    data.strava.length ? `Strava ${data.strava.length}` : null,
    data.hcPending.length ? `HC ready ${data.hcPending.length}` : null,
    data.hcNeedsLabel.length ? `HC need label ${data.hcNeedsLabel.length}` : null,
  ].filter(Boolean)

  return (
    <View style={[styles.wrap, { borderColor: colors.warning, backgroundColor: 'rgba(245,158,11,0.12)' }]}>
      <Pressable onPress={() => setOpen(o => !o)} style={styles.card}>
        <Feather name="alert-circle" size={18} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {data.total} activit{data.total === 1 ? 'y' : 'ies'} need attention
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {subParts.join(' · ')}
            {' — tap to review'}
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {data.hcNeedsLabel.length > 0 ? (
            <Text style={{ color: colors.warning, fontSize: 11, marginBottom: 6 }}>
              HC stubs still need a real exercise label (Type 79 → Walking, etc.).
            </Text>
          ) : null}
          {preview.map((item, i) => {
            const label = item.exercise ?? item.name ?? 'Activity'
            const needs = isRawTypeLabel(label)
            return (
              <Text
                key={`${item.externalId ?? label ?? i}`}
                style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4 }}
              >
                {(item.date ?? '').slice(5)} · {label}
                {item.calories ? ` · ${item.calories} kcal` : ''}
                {needs ? ' · needs label' : ''}
              </Text>
            )
          })}
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
