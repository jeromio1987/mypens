import React, { useEffect, useState } from 'react'
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
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

type PanelListItem = {
  id: string
  drawDate: string
  labName: string | null
  fasting: boolean
  notes: string | null
  markerCount: number
}

type Marker = {
  id: string
  code: string
  label: string
  valueNum: number | null
  valueText: string | null
  unit: string | null
  refLow: number | null
  refHigh: number | null
}

type PanelDetail = PanelListItem & {
  markers: Marker[]
}

function markerCritical(m: Marker): boolean {
  if (m.valueNum == null) return false
  if (m.refHigh != null && m.valueNum > m.refHigh) return true
  if (m.refLow != null && m.valueNum < m.refLow) return true
  return false
}

function formatValue(m: Marker): string {
  if (m.valueNum != null) {
    const u = m.unit ? ` ${m.unit}` : ''
    return `${m.valueNum}${u}`
  }
  return m.valueText?.trim() || '—'
}

export default function BloodworkScreen() {
  const configured = isPensApiConfigured()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['bloodwork-panels'],
    enabled: configured,
    queryFn: async (): Promise<PanelListItem[]> => {
      const res = await pensFetch('/api/bloodwork/panels')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Panels ${res.status}`)
      }
      return (await res.json()) as PanelListItem[]
    },
  })

  useEffect(() => {
    if (!selectedId && listQ.data?.[0]?.id) setSelectedId(listQ.data[0].id)
  }, [listQ.data, selectedId])

  const detailQ = useQuery({
    queryKey: ['bloodwork-panel', selectedId],
    enabled: configured && Boolean(selectedId),
    queryFn: async (): Promise<PanelDetail> => {
      const res = await pensFetch(`/api/bloodwork/panels/${selectedId}`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Panel ${res.status}`)
      }
      return (await res.json()) as PanelDetail
    },
  })

  const panels = listQ.data ?? []
  const panel = detailQ.data
  const criticalCount = panel?.markers.filter(markerCritical).length ?? 0

  return (
    <ContinentalScreen
      eyebrow="Hematological statement"
      title="Bloodwork"
      subtitle="Serum liabilities from stored lab panels."
      refreshing={listQ.isRefetching || detailQ.isRefetching}
      onRefresh={() => {
        void listQ.refetch()
        void detailQ.refetch()
      }}
    >
      <ApiGate configured={configured}>
        {listQ.isLoading ? <LoadingBlock /> : null}
        {listQ.error ? <EmptyHint>{(listQ.error as Error).message}</EmptyHint> : null}
        {!listQ.isLoading && panels.length === 0 ? (
          <EmptyHint>No panels yet. Add labs on the web /bloodwork ledger.</EmptyHint>
        ) : null}

        {panels.length > 0 ? (
          <>
            <SectionLabel>Draws</SectionLabel>
            <View style={styles.drawRow}>
              {panels.slice(0, 6).map(p => {
                const on = p.id === selectedId
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedId(p.id)}
                    style={[styles.drawChip, on && styles.drawChipOn]}
                  >
                    <Text style={[styles.drawText, on && styles.drawTextOn]}>{p.drawDate}</Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}

        {panel ? (
          <>
            <View style={styles.chipGrid}>
              <MetricChip label="Draw" value={panel.drawDate} />
              <MetricChip label="Markers" value={String(panel.markers.length)} />
              <MetricChip
                label="Out of range"
                value={String(criticalCount)}
                critical={criticalCount > 0}
              />
              <MetricChip label="Fasting" value={panel.fasting ? 'Yes' : 'No'} />
            </View>

            <SectionLabel>Serum liabilities</SectionLabel>
            {panel.markers.length === 0 ? (
              <EmptyHint>No markers on this panel.</EmptyHint>
            ) : (
              panel.markers.map(m => {
                const crit = markerCritical(m)
                return (
                  <Block key={m.id} elevated={crit}>
                    <View style={styles.markerTop}>
                      <Text style={[styles.markerLabel, crit && { color: C.oxblood }]}>
                        {m.label}
                      </Text>
                      <Text style={[styles.markerValue, crit && { color: C.oxblood }]}>
                        {formatValue(m)}
                      </Text>
                    </View>
                    <Text style={styles.markerMeta}>
                      {m.code}
                      {m.refLow != null || m.refHigh != null
                        ? ` · ref ${m.refLow ?? '—'}–${m.refHigh ?? '—'}${m.unit ? ` ${m.unit}` : ''}`
                        : ''}
                      {crit ? ' · OUT OF RANGE' : ''}
                    </Text>
                  </Block>
                )
              })
            )}
            {panel.notes ? (
              <Block>
                <SectionLabel>Notes</SectionLabel>
                <Text style={styles.notes}>{panel.notes}</Text>
              </Block>
            ) : null}
          </>
        ) : detailQ.isLoading && selectedId ? (
          <LoadingBlock />
        ) : null}
      </ApiGate>
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  drawRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawChip: {
    backgroundColor: C.surfaceHigh,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  drawChipOn: {
    backgroundColor: C.cream,
  },
  drawText: {
    color: C.cream,
    fontSize: 12,
    fontWeight: '600',
  },
  drawTextOn: {
    color: C.onPrimary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  markerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  markerLabel: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 16,
    flex: 1,
  },
  markerValue: {
    color: C.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  markerMeta: {
    color: C.creamMuted,
    fontSize: 11,
  },
  notes: {
    color: C.cream,
    fontSize: 13,
    lineHeight: 18,
  },
})
