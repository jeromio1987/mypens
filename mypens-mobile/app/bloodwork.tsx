import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'

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
  describePensError,
  isPensApiConfigured,
  pensFetch,
  PENS_PHOTO_TIMEOUT_MS,
} from '@/lib/pensApi'
import { appendImageFormFile, readPensJson } from '@/lib/photoUpload'
import { today } from '@/lib/timeWindow'

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

type DraftMarker = {
  code: string
  label: string
  valueNum: number | null
  valueText: string | null
  unit: string | null
  refLow: number | null
  refHigh: number | null
}

type PhotoDraft = {
  drawDate: string | null
  labName: string | null
  fasting: boolean | null
  markers: DraftMarker[]
  disclaimer?: string
}

type MarkerDelta = {
  code: string
  label: string
  previous: number | null
  latest: number | null
  delta: number | null
  unit: string | null
  trend: 'up' | 'down' | 'flat' | 'unknown'
}

type ChartSeries = {
  code: string
  label: string
  unit: string | null
  prior: number | null
  latest: number | null
  deltaPct: number | null
  latestFlag: 'below' | 'within' | 'above' | 'unknown'
  group: string
}

type ChartPayload = {
  series: ChartSeries[]
  panels: Array<{ id: string; drawDate: string }>
  disclaimer: string
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

function fmtDelta(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export default function BloodworkScreen() {
  const configured = isPensApiConfigured()
  const qc = useQueryClient()
  const router = useRouter()
  const photoAbortRef = useRef<AbortController | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<PhotoDraft | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [trialBusy, setTrialBusy] = useState<string | null>(null)

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

  const chartQ = useQuery({
    queryKey: ['bloodwork-chart'],
    enabled: configured,
    queryFn: async (): Promise<ChartPayload> => {
      const res = await pensFetch('/api/bloodwork/chart')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Chart ${res.status}`)
      }
      return (await res.json()) as ChartPayload
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

  const deltaQ = useQuery({
    queryKey: ['bloodwork-delta', selectedId],
    enabled: configured && Boolean(selectedId),
    queryFn: async () => {
      const res = await pensFetch(`/api/bloodwork/panels/${selectedId}/delta`)
      if (!res.ok) return { present: false, deltas: [] as MarkerDelta[], summaryLine: '' }
      return (await res.json()) as {
        present: boolean
        deltas: MarkerDelta[]
        summaryLine: string
        previousDrawDate?: string | null
      }
    },
  })

  const panels = listQ.data ?? []
  const panel = detailQ.data
  const criticalCount = panel?.markers.filter(markerCritical).length ?? 0

  const alertPhotoPermission = (kind: 'camera' | 'library') => {
    const title = kind === 'camera' ? 'Camera permission' : 'Photos permission'
    const body =
      kind === 'camera'
        ? Platform.OS === 'android'
          ? 'Camera is blocked. Open Settings → Apps → My Pens → Permissions → Camera → Allow.'
          : 'Camera is blocked. Open Settings → My Pens → Camera → Allow.'
        : Platform.OS === 'android'
          ? 'Photos access is blocked. Open Settings → Apps → My Pens → Permissions → Photos / Files → Allow.'
          : 'Photos access is blocked. Open Settings → My Pens → Photos → Allow.'
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ])
  }

  const runScan = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    photoAbortRef.current?.abort()
    const ctrl = new AbortController()
    photoAbortRef.current = ctrl
    setAnalyzing(true)
    setPhotoError(null)
    setDraft(null)
    try {
      const form = new FormData()
      appendImageFormFile(form, 'file', asset, 'lab')
      const res = await pensFetch('/api/bloodwork/photo-analyze', {
        method: 'POST',
        body: form,
        timeoutMs: PENS_PHOTO_TIMEOUT_MS,
        signal: ctrl.signal,
      })
      const data = await readPensJson<PhotoDraft>(res)
      if (!res.ok) throw new Error(data.error || `Analyze failed (${res.status})`)
      setDraft({
        drawDate: data.drawDate ?? null,
        labName: data.labName ?? null,
        fasting: typeof data.fasting === 'boolean' ? data.fasting : null,
        markers: Array.isArray(data.markers) ? data.markers : [],
        disclaimer: data.disclaimer,
      })
    } catch (e: unknown) {
      const aborted =
        ctrl.signal.aborted ||
        (e instanceof Error && (e.name === 'AbortError' || /abort/i.test(e.message)))
      if (!aborted) setPhotoError(describePensError(e))
    } finally {
      if (photoAbortRef.current === ctrl) photoAbortRef.current = null
      setAnalyzing(false)
    }
  }

  const cancelPhoto = () => {
    photoAbortRef.current?.abort()
    photoAbortRef.current = null
    setAnalyzing(false)
  }

  const takePhoto = async () => {
    if (!configured) {
      Alert.alert('API not configured', 'Set EXPO_PUBLIC_PENS_API_URL + TOKEN, then restart Expo.')
      return
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        alertPhotoPermission('camera')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      })
      await runScan(result)
    } catch (e: unknown) {
      setAnalyzing(false)
      setPhotoError(describePensError(e))
    }
  }

  const pickPhoto = async () => {
    if (!configured) {
      Alert.alert('API not configured', 'Set EXPO_PUBLIC_PENS_API_URL + TOKEN, then restart Expo.')
      return
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        alertPhotoPermission('library')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      })
      await runScan(result)
    } catch (e: unknown) {
      setAnalyzing(false)
      setPhotoError(describePensError(e))
    }
  }

  const confirmDraft = async () => {
    if (!draft || saving) return
    const date =
      draft.drawDate && /^\d{4}-\d{2}-\d{2}$/.test(draft.drawDate)
        ? draft.drawDate
        : today()
    setSaving(true)
    setPhotoError(null)
    try {
      const res = await pensFetch('/api/bloodwork/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawDate: date,
          labName: draft.labName?.trim() || null,
          fasting: draft.fasting ?? false,
          markers: draft.markers.map((m, i) => ({
            code: m.code,
            label: m.label,
            valueNum: m.valueNum,
            valueText: m.valueText,
            unit: m.unit,
            refLow: m.refLow,
            refHigh: m.refHigh,
            sortOrder: i,
          })),
        }),
      })
      const d = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !d.id) throw new Error(d.error || 'Create failed')
      setDraft(null)
      setSelectedId(d.id)
      void qc.invalidateQueries({ queryKey: ['bloodwork-panels'] })
      void qc.invalidateQueries({ queryKey: ['bloodwork-panel', d.id] })
      void qc.invalidateQueries({ queryKey: ['bloodwork-chart'] })
      void qc.invalidateQueries({ queryKey: ['bloodwork-latest-summary'] })
    } catch (e: unknown) {
      setPhotoError(describePensError(e))
    } finally {
      setSaving(false)
    }
  }

  const startLabTrial = async (signalId: 'iron_low_vs_load' | 'thyroid_out_of_ref') => {
    setTrialBusy(signalId)
    try {
      const action =
        signalId === 'iron_low_vs_load'
          ? 'Treat ferritin + load as soft confounders only — ease hard volume one week and review labs with your clinician; not medical advice.'
          : 'TSH flag is educational context only — do not change BMR or cut calories from labs; discuss with your clinician.'
      const res = await pensFetch('/api/intervention-trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, action, horizonDays: 14 }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; trial?: { dueAt?: string } }
      if (!res.ok) throw new Error(j.error || `Trial failed (${res.status})`)
      Alert.alert('Trial started', `14-day soft trial due ${j.trial?.dueAt ?? 'soon'} — not medical advice.`)
    } catch (e: unknown) {
      Alert.alert('Trial', describePensError(e))
    } finally {
      setTrialBusy(null)
    }
  }

  const ferritinLow = panel?.markers.some(
    m =>
      /ferritin/i.test(m.code) &&
      m.valueNum != null &&
      m.refLow != null &&
      m.valueNum < m.refLow,
  )
  const tshOut = panel?.markers.some(
    m =>
      /^tsh$/i.test(m.code) &&
      m.valueNum != null &&
      ((m.refLow != null && m.valueNum < m.refLow) ||
        (m.refHigh != null && m.valueNum > m.refHigh)),
  )

  return (
    <ContinentalScreen
      eyebrow="Hematological statement"
      title="Bloodwork"
      subtitle="Serum liabilities from stored lab panels."
      showBack
      refreshing={listQ.isRefetching || detailQ.isRefetching}
      onRefresh={() => {
        void listQ.refetch()
        void detailQ.refetch()
        void deltaQ.refetch()
        void chartQ.refetch()
      }}
    >
      <ApiGate configured={configured}>
        <Pressable onPress={() => router.push('/audit' as never)} style={styles.auditLink}>
          <Text style={styles.auditLinkText}>← The Audit</Text>
        </Pressable>
        <SectionLabel>Photo capture</SectionLabel>
        <View style={styles.photoRow}>
          <Pressable
            onPress={() => void takePhoto()}
            disabled={analyzing}
            style={[styles.photoBtn, analyzing && { opacity: 0.5 }]}
          >
            <Text style={styles.photoBtnText}>{analyzing ? 'Reading…' : 'Take photo'}</Text>
          </Pressable>
          <Pressable
            onPress={() => void pickPhoto()}
            disabled={analyzing}
            style={[styles.photoBtn, styles.photoBtnGhost, analyzing && { opacity: 0.5 }]}
          >
            <Text style={styles.photoBtnGhostText}>Pick photo</Text>
          </Pressable>
        </View>
        {analyzing ? (
          <Pressable onPress={cancelPhoto} style={[styles.photoBtn, styles.photoBtnGhost, { marginBottom: 8 }]}>
            <Text style={styles.photoBtnGhostText}>Cancel</Text>
          </Pressable>
        ) : null}
        {analyzing ? <ActivityIndicator color={C.cream} style={{ marginVertical: 8 }} /> : null}
        {photoError ? <EmptyHint>{photoError}</EmptyHint> : null}
        {draft ? (
          <Block elevated>
            <Text style={styles.draftTitle}>
              Draft · {draft.markers.length} markers
              {draft.drawDate ? ` · ${draft.drawDate}` : ''}
            </Text>
            {draft.markers.slice(0, 12).map((m, i) => (
              <View key={`${m.code}-${i}`} style={styles.draftRow}>
                <Text style={styles.draftLabel} numberOfLines={1}>
                  {m.label}
                </Text>
                <Text style={styles.draftValue}>
                  {m.valueNum != null ? m.valueNum : m.valueText ?? '—'}
                  {m.unit ? ` ${m.unit}` : ''}
                </Text>
              </View>
            ))}
            {draft.markers.length > 12 ? (
              <Text style={styles.markerMeta}>…and {draft.markers.length - 12} more</Text>
            ) : null}
            {draft.disclaimer ? <Text style={styles.notes}>{draft.disclaimer}</Text> : null}
            <View style={styles.photoRow}>
              <Pressable
                onPress={() => void confirmDraft()}
                disabled={saving || draft.markers.length === 0}
                style={[styles.photoBtn, (saving || draft.markers.length === 0) && { opacity: 0.5 }]}
              >
                <Text style={styles.photoBtnText}>{saving ? 'Saving…' : 'Confirm & save'}</Text>
              </Pressable>
              <Pressable onPress={() => setDraft(null)} style={[styles.photoBtn, styles.photoBtnGhost]}>
                <Text style={styles.photoBtnGhostText}>Discard</Text>
              </Pressable>
            </View>
          </Block>
        ) : null}

        {listQ.isLoading ? <LoadingBlock /> : null}
        {listQ.error ? <EmptyHint>{(listQ.error as Error).message}</EmptyHint> : null}
        {!listQ.isLoading && panels.length === 0 && !draft ? (
          <EmptyHint>No panels yet. Capture a lab photo or add on web /bloodwork.</EmptyHint>
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

        {chartQ.data && chartQ.data.series.length > 0 ? (
          <>
            <SectionLabel>Blood chart · prior → latest</SectionLabel>
            <Block elevated>
              <Text style={styles.notes}>
                Educational ledger only. Flagged or high-signal rows from stored panels.
              </Text>
              {chartQ.data.series
                .filter(
                  s =>
                    s.latestFlag === 'below' ||
                    s.latestFlag === 'above' ||
                    s.deltaPct != null ||
                    ['iron', 'ferritin', 'ldl', 'hdl', 'hemoglobin', 'testosterone', 'cortisol'].includes(
                      s.code,
                    ),
                )
                .slice(0, 12)
                .map(s => (
                  <View key={s.code} style={styles.draftRow}>
                    <Text style={styles.draftLabel} numberOfLines={1}>
                      {s.label}
                      {s.latestFlag === 'below' || s.latestFlag === 'above' ? ' · flag' : ''}
                    </Text>
                    <Text style={styles.draftValue}>
                      {s.prior != null ? `${s.prior} → ` : ''}
                      {s.latest ?? '—'}
                      {s.unit ? ` ${s.unit}` : ''}
                      {s.deltaPct != null
                        ? ` (${s.deltaPct > 0 ? '↑' : s.deltaPct < 0 ? '↓' : '→'}${Math.abs(s.deltaPct)}%)`
                        : ''}
                    </Text>
                  </View>
                ))}
            </Block>
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

            {deltaQ.data?.present && deltaQ.data.deltas.length > 0 ? (
              <>
                <SectionLabel
                  children={
                    deltaQ.data.previousDrawDate
                      ? `vs prior ${deltaQ.data.previousDrawDate}`
                      : 'vs prior'
                  }
                />
                <Block>
                  {deltaQ.data.deltas
                    .filter(d => d.delta != null)
                    .slice(0, 8)
                    .map(d => (
                      <View key={d.code} style={styles.draftRow}>
                        <Text style={styles.draftLabel} numberOfLines={1}>
                          {d.label}
                        </Text>
                        <Text
                          style={[
                            styles.draftValue,
                            d.trend === 'up' && { color: C.oxblood },
                            d.trend === 'down' && { color: '#7dd3c0' },
                          ]}
                        >
                          {d.previous} → {d.latest}
                          {d.unit ? ` ${d.unit}` : ''} ({fmtDelta(d.delta!)})
                        </Text>
                      </View>
                    ))}
                  <Text style={styles.notes}>
                    Educational deltas only — not a diagnosis or medical trend.
                  </Text>
                </Block>
              </>
            ) : null}

            {(ferritinLow || tshOut) && (
              <Block>
                <Text style={styles.draftTitle}>Soft n-of-1 trial</Text>
                <Text style={styles.notes}>
                  Educational only — start a 14-day file trial; not treatment advice.
                </Text>
                <View style={styles.photoRow}>
                  {ferritinLow ? (
                    <Pressable
                      onPress={() => void startLabTrial('iron_low_vs_load')}
                      disabled={trialBusy != null}
                      style={[styles.photoBtn, trialBusy && { opacity: 0.5 }]}
                    >
                      <Text style={styles.photoBtnText}>
                        {trialBusy === 'iron_low_vs_load' ? '…' : 'Start 14d iron trial'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {tshOut ? (
                    <Pressable
                      onPress={() => void startLabTrial('thyroid_out_of_ref')}
                      disabled={trialBusy != null}
                      style={[styles.photoBtn, styles.photoBtnGhost, trialBusy && { opacity: 0.5 }]}
                    >
                      <Text style={styles.photoBtnGhostText}>
                        {trialBusy === 'thyroid_out_of_ref' ? '…' : 'Start 14d thyroid trial'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Block>
            )}

            <SectionLabel>Serum liabilities</SectionLabel>
            {panel.markers.length === 0 ? (
              <EmptyHint>No markers on this panel.</EmptyHint>
            ) : (
              panel.markers.map(m => {
                const crit = markerCritical(m)
                const delta = deltaQ.data?.deltas.find(d => d.code === m.code)
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
                      {delta?.delta != null
                        ? ` · Δ ${fmtDelta(delta.delta)} vs prior`
                        : ''}
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
  auditLink: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  auditLinkText: {
    color: C.creamMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  photoBtn: {
    backgroundColor: C.oxblood,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  photoBtnGhost: {
    backgroundColor: C.surfaceHigh,
  },
  photoBtnText: {
    color: C.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  photoBtnGhostText: {
    color: C.cream,
    fontSize: 13,
    fontWeight: '600',
  },
  draftTitle: {
    color: C.cream,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  draftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  draftLabel: {
    color: C.creamMuted,
    fontSize: 12,
    flex: 1,
  },
  draftValue: {
    color: C.cream,
    fontSize: 12,
    fontWeight: '600',
  },
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
    marginTop: 6,
  },
})
