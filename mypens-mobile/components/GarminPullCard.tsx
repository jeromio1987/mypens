import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

type SyncResult = { label: string; ok: boolean; detail: string }

/** Pull last N days of Garmin sleep / body / activities into MY PENS. */
export function GarminPullCard({ days = 7 }: { days?: number }) {
  const colors = useColors()
  const qc = useQueryClient()
  const enabled = isPensApiConfigured()
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<SyncResult[] | null>(null)

  if (!enabled) return null

  async function run() {
    setBusy(true)
    setResults(null)
    const out: SyncResult[] = []
    const jobs: { label: string; path: string }[] = [
      { label: 'Sleep', path: `/api/integrations/garmin/sleep-sync?days=${days}` },
      { label: 'Body', path: `/api/integrations/garmin/body-sync?days=${days}` },
      { label: 'Activities', path: `/api/integrations/garmin/activities?days=${days}` },
    ]
    for (const job of jobs) {
      try {
        const res = await pensFetch(job.path, { method: job.label === 'Activities' ? 'GET' : 'POST' })
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (!res.ok) {
          out.push({ label: job.label, ok: false, detail: String(j.error ?? res.status) })
        } else if (job.label === 'Activities') {
          const items = Array.isArray(j.items) ? j.items : []
          const pending = items.filter((x: { alreadyImported?: boolean }) => !x.alreadyImported).length
          out.push({
            label: job.label,
            ok: true,
            detail: `${items.length} recent · ${pending} not imported`,
          })
        } else {
          out.push({
            label: job.label,
            ok: true,
            detail: `ingested ${j.ingested ?? 0}, skipped ${j.skipped ?? 0}`,
          })
        }
      } catch (e) {
        out.push({ label: job.label, ok: false, detail: e instanceof Error ? e.message : 'failed' })
      }
    }
    setResults(out)
    setBusy(false)
    void qc.invalidateQueries({ queryKey: ['sleep'] })
    void qc.invalidateQueries({ queryKey: ['weight'] })
    void qc.invalidateQueries({ queryKey: ['training'] })
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Garmin pull</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Last {days} days — sleep, body weight, activity list (no full dump).
      </Text>
      <Pressable
        onPress={() => void run()}
        disabled={busy}
        style={[styles.btn, { backgroundColor: '#0ea5e9', opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="download-cloud" size={16} color="#fff" />
            <Text style={styles.btnText}>Pull last {days} days</Text>
          </>
        )}
      </Pressable>
      {results?.map(r => (
        <Text
          key={r.label}
          style={{ color: r.ok ? colors.mutedForeground : colors.warning, fontSize: 12, marginTop: 6 }}
        >
          {r.label}: {r.detail}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4, marginBottom: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
})
