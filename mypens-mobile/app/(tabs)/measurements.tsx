import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LineChart } from 'react-native-gifted-charts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { usePensSync, flushOfflineQueueWithAlert } from '@/hooks/usePensSync'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/generateId'
import { pensFetch, isPensApiConfigured } from '@/lib/pensApi'
import { enqueueOp } from '@/lib/offlineQueue'

const MOD = MODULE_COLORS.measurements
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface BodyMeasurement {
  id: string
  date: string
  waistCm?: number
  chestCm?: number
  hipsCm?: number
  leftArmCm?: number
  rightArmCm?: number
  leftThighCm?: number
  rightThighCm?: number
  neckCm?: number
  notes?: string
}

type MeasurementKey = keyof Omit<BodyMeasurement, 'id' | 'date' | 'notes'>

const QUICK_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'waistCm', label: 'Waist' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'hipsCm', label: 'Hips' },
]

const DETAILED_FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: 'leftArmCm', label: 'Left arm' },
  { key: 'rightArmCm', label: 'Right arm' },
  { key: 'leftThighCm', label: 'Left thigh' },
  { key: 'rightThighCm', label: 'Right thigh' },
  { key: 'neckCm', label: 'Neck' },
]

const CHART_OPTIONS: { key: MeasurementKey; label: string; color: string }[] = [
  { key: 'waistCm', label: 'Waist', color: MOD.primary },
  { key: 'chestCm', label: 'Chest', color: '#3b82f6' },
  { key: 'hipsCm', label: 'Hips', color: '#8b5cf6' },
]

export default function MeasurementsScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()
  const useApi = isPensApiConfigured()
  const { pending, online, refresh: refreshQueue } = usePensSync()

  const [detailed, setDetailed] = useState(false)
  const [activeChart, setActiveChart] = useState<MeasurementKey>('waistCm')
  const [form, setForm] = useState<Record<MeasurementKey, string>>({
    waistCm: '', chestCm: '', hipsCm: '',
    leftArmCm: '', rightArmCm: '',
    leftThighCm: '', rightThighCm: '',
    neckCm: '',
  })

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery<BodyMeasurement[]>({
    queryKey: ['measurements', useApi ? 'api' : 'supabase'],
    queryFn: async () => {
      if (useApi) {
        const r = await pensFetch('/api/measurements?limit=90')
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'Measurements fetch failed')
        }
        const rows = (await r.json()) as BodyMeasurement[]
        if (!Array.isArray(rows)) return []
        return [...rows].sort((a, b) => a.date.localeCompare(b.date))
      }
      const { data, error } = await supabase
        .from('BodyMeasurement')
        .select('*')
        .order('date', { ascending: true })
        .limit(60)
      if (error) throw error
      return data ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const hasAny = QUICK_FIELDS.some((f) => form[f.key] !== '')
      if (!hasAny) throw new Error('Enter at least one measurement')

      const payload: Record<string, unknown> = { date: today() }
      for (const { key } of [...QUICK_FIELDS, ...DETAILED_FIELDS]) {
        if (form[key] !== '') payload[key] = parseFloat(form[key])
      }

      if (useApi) {
        if (!online) {
          await enqueueOp({ type: 'measurements_post', payload })
          await refreshQueue()
          return
        }
        try {
          const r = await pensFetch('/api/measurements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Save failed')
          }
        } catch {
          await enqueueOp({ type: 'measurements_post', payload })
          await refreshQueue()
          return
        }
        return
      }

      const row: Record<string, unknown> = { id: generateId(), date: today() }
      for (const { key } of [...QUICK_FIELDS, ...DETAILED_FIELDS]) {
        if (form[key] !== '') row[key] = parseFloat(form[key])
      }

      const { error } = await supabase.from('BodyMeasurement').upsert(row, { onConflict: 'date' })
      if (error) throw error
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (useApi) {
        await flushOfflineQueueWithAlert()
        await refreshQueue()
      }
      qc.invalidateQueries({ queryKey: ['measurements'] })
      setForm({
        waistCm: '', chestCm: '', hipsCm: '',
        leftArmCm: '', rightArmCm: '',
        leftThighCm: '', rightThighCm: '',
        neckCm: '',
      })
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const latest = entries[entries.length - 1]
  const prev = entries[entries.length - 2]

  const chartData = entries
    .filter((e) => e[activeChart] != null)
    .slice(-30)
    .map((e) => ({ value: e[activeChart] as number }))

  const chartW = width - 48
  const accentBg = isDark ? MOD.bgDark : MOD.bg
  const topInset = Platform.OS === 'web' ? 67 : insets.top

  const MeasInput = ({ field, label }: { field: MeasurementKey; label: string }) => (
    <View style={styles.measField}>
      <Text style={[styles.measLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.measInputWrap, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        <TextInput
          value={form[field]}
          onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
          keyboardType="decimal-pad"
          placeholder="cm"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.measInput, { color: colors.foreground }]}
        />
      </View>
    </View>
  )

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={MOD.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <MaterialCommunityIcons name="tape-measure" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Measurements</Text>
        </View>
        {latest?.waistCm && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.latestVal, { color: colors.foreground }]}>{latest.waistCm} cm</Text>
            <Text style={[styles.latestSub, { color: colors.mutedForeground }]}>waist</Text>
          </View>
        )}
      </View>

      {pending > 0 ? (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.warning,
            backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.18)',
          }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13 }}>
            {pending} change{pending > 1 ? 's' : ''} queued for sync when you are back online.
          </Text>
        </View>
      ) : null}

      {/* Latest summary */}
      {latest && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest</Text>
          <View style={styles.statsGrid}>
            {QUICK_FIELDS.map(({ key, label }) =>
              latest[key] != null ? (
                <View key={key} style={[styles.statCell, { backgroundColor: accentBg }]}>
                  <Text style={[styles.statValue, { color: MOD.primary }]}>{latest[key]}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  {prev?.[key] != null && (
                    <Text style={[styles.statDelta, { color: (latest[key] as number) < (prev[key] as number) ? '#22c55e' : (colors.mutedForeground ?? colors.foreground) }]}>
                      {((latest[key] as number) - (prev[key] as number)).toFixed(1)} cm
                    </Text>
                  )}
                </View>
              ) : null,
            )}
          </View>
        </View>
      )}

      {/* Form */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.formHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Log today</Text>
          <View style={styles.detailToggle}>
            <Text style={[styles.detailToggleLabel, { color: colors.mutedForeground }]}>Detailed</Text>
            <Switch
              value={detailed}
              onValueChange={setDetailed}
              trackColor={{ true: MOD.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        <View style={styles.measGrid}>
          {QUICK_FIELDS.map(({ key, label }) => (
            <MeasInput key={key} field={key} label={label} />
          ))}
        </View>

        {detailed && (
          <View style={styles.measGrid}>
            {DETAILED_FIELDS.map(({ key, label }) => (
              <MeasInput key={key} field={key} label={label} />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: MOD.primary, opacity: pressed || mutation.isPending ? 0.7 : 1 },
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Save measurements</Text>
          )}
        </Pressable>
      </View>

      {/* Chart */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trend</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={styles.chartTabs}>
            {CHART_OPTIONS.map(({ key, label, color }) => (
              <Pressable
                key={key}
                onPress={() => setActiveChart(key)}
                style={[
                  styles.chartTab,
                  { backgroundColor: activeChart === key ? color : colors.secondary, borderColor: activeChart === key ? color : colors.border },
                ]}
              >
                <Text style={{ color: activeChart === key ? '#fff' : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={MOD.primary} />
        ) : chartData.length > 1 ? (
          <LineChart
            data={chartData}
            color={CHART_OPTIONS.find((o) => o.key === activeChart)?.color ?? MOD.primary}
            thickness={2.5}
            noOfSections={4}
            width={chartW - 32}
            spacing={chartData.length > 20 ? (chartW - 80) / chartData.length : 20}
            initialSpacing={8}
            endSpacing={8}
            yAxisLabelWidth={44}
            yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.border}
            dataPointsColor={CHART_OPTIONS.find((o) => o.key === activeChart)?.color ?? MOD.primary}
            dataPointsRadius={3}
            areaChart
            startFillColor={`${CHART_OPTIONS.find((o) => o.key === activeChart)?.color ?? MOD.primary}30`}
            endFillColor={`${CHART_OPTIONS.find((o) => o.key === activeChart)?.color ?? MOD.primary}05`}
          />
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="tape-measure" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No data yet for this measurement.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  moduleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  moduleLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  latestVal: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  latestSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  statDelta: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailToggleLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  measGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  measField: { width: '31%' },
  measLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  measInputWrap: { borderWidth: 1, borderRadius: 8, height: 44, overflow: 'hidden' },
  measInput: { flex: 1, paddingHorizontal: 8, fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  chartTabs: { flexDirection: 'row', gap: 6 },
  chartTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
})
