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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import {
  calculateWeightBreakdown,
  calculateRollingBaseline,
  detectOutlier,
  calculateDynamicBand,
  estimateSodiumRetention,
  estimateHardTrainingRetention,
  type WeightInput,
  type HistoryEntry,
} from '@/lib/retentionModels'

const MOD = MODULE_COLORS.weight
const today = () => new Date().toISOString().split('T')[0]

interface WeightEntry {
  id: string
  date: string
  scaleKg: number
  trueWeightKg: number
  bodyFatPct?: number
  muscleMassKg?: number
  creatineRetentionKg: number
  alcoholRetentionKg: number
  glycogenRetentionKg: number
  hardTraining: boolean
  morningReading: boolean
  highSodium: boolean
  restaurantMeal: boolean
  flightDay: boolean
  illnessDay: boolean
  creatineDoseG: number
  creatineDaysOn: number
  alcoholUnits: number
  hoursSinceAlcohol: number
  carbsG: number
  tanitaReliable: boolean
  boneMassKg?: number
  bodyWaterPct?: number
  visceralFat?: number
}

const defaultForm = {
  date: today(),
  scaleKg: '',
  creatineDoseG: '0',
  creatineDaysOn: '0',
  alcoholUnits: '0',
  hoursSinceAlcohol: '0',
  carbsG: '0',
  hardTraining: false,
  morningReading: true,
  highSodium: false,
  restaurantMeal: false,
  flightDay: false,
  illnessDay: false,
  bodyFatPct: '',
  muscleMassKg: '',
  boneMassKg: '',
  bodyWaterPct: '',
  visceralFat: '',
}

export default function WeightScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()

  const [form, setForm] = useState({ ...defaultForm })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTanita, setShowTanita] = useState(false)

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery<WeightEntry[]>({
    queryKey: ['weight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('WeightEntry')
        .select('*')
        .order('date', { ascending: true })
        .limit(60)
      if (error) throw error
      return data ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const scaleKg = parseFloat(form.scaleKg)
      if (isNaN(scaleKg) || scaleKg <= 0) throw new Error('Enter a valid weight')

      const input: WeightInput = {
        scaleKg,
        creatineDoseG: parseFloat(form.creatineDoseG) || 0,
        creatineDaysOn: parseFloat(form.creatineDaysOn) || 0,
        alcoholUnits: parseFloat(form.alcoholUnits) || 0,
        hoursSinceAlcohol: parseFloat(form.hoursSinceAlcohol) || 0,
        carbsG: parseFloat(form.carbsG) || 0,
        hardTraining: form.hardTraining,
        morningReading: form.morningReading,
        highSodium: form.highSodium,
        restaurantMeal: form.restaurantMeal,
        flightDay: form.flightDay,
        illnessDay: form.illnessDay,
      }

      const bd = calculateWeightBreakdown(input)

      const row: Record<string, unknown> = {
        date: form.date,
        scaleKg,
        trueWeightKg: bd.trueWeightKg,
        creatineRetentionKg: bd.creatineRetentionKg,
        alcoholRetentionKg: bd.alcoholRetentionKg,
        glycogenRetentionKg: bd.glycogenRetentionKg,
        tanitaReliable: bd.tanitaReliable,
        hardTraining: form.hardTraining,
        morningReading: form.morningReading,
        highSodium: form.highSodium,
        restaurantMeal: form.restaurantMeal,
        flightDay: form.flightDay,
        illnessDay: form.illnessDay,
        creatineDoseG: input.creatineDoseG,
        creatineDaysOn: input.creatineDaysOn,
        alcoholUnits: input.alcoholUnits,
        hoursSinceAlcohol: input.hoursSinceAlcohol,
        carbsG: input.carbsG,
      }

      if (form.bodyFatPct) row.bodyFatPct = parseFloat(form.bodyFatPct)
      if (form.muscleMassKg) row.muscleMassKg = parseFloat(form.muscleMassKg)
      if (form.boneMassKg) row.boneMassKg = parseFloat(form.boneMassKg)
      if (form.bodyWaterPct) row.bodyWaterPct = parseFloat(form.bodyWaterPct)
      if (form.visceralFat) row.visceralFat = parseFloat(form.visceralFat)

      const { error } = await supabase.from('WeightEntry').insert(row)
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['weight'] })
      setForm({ ...defaultForm })
      setShowAdvanced(false)
      setShowTanita(false)
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message)
    },
  })

  // Enrich entries with rolling baseline
  const enriched = React.useMemo(() => {
    const history: HistoryEntry[] = []
    return entries.map((e) => {
      const sodiumKg = estimateSodiumRetention(e.highSodium, e.restaurantMeal)
      const hardTrainingKg = estimateHardTrainingRetention(e.hardTraining)
      const baseline = calculateRollingBaseline(history)
      const { bandKg } = calculateDynamicBand(history, 'medium')
      const isOutlier = detectOutlier(e.scaleKg, baseline, bandKg)
      history.push({ date: e.date, trueWeightKg: e.trueWeightKg, confidence: 'medium' })
      return { ...e, sodiumKg, hardTrainingKg, baseline, isOutlier }
    })
  }, [entries])

  const chartData = enriched.slice(-30).map((e) => ({ value: e.scaleKg }))
  const chartData2 = enriched.slice(-30).map((e) => ({ value: e.trueWeightKg }))
  const latest = enriched[enriched.length - 1]
  const prev = enriched[enriched.length - 2]
  const delta = latest && prev ? (latest.trueWeightKg - prev.trueWeightKg).toFixed(2) : null

  const chartW = width - 48
  const accentBg = isDark ? MOD.bgDark : MOD.bg

  const ToggleRow = ({
    label,
    value,
    onToggle,
  }: {
    label: string
    value: boolean
    onToggle: (v: boolean) => void
  }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: MOD.primary, false: colors.border }}
        thumbColor={colors.card}
      />
    </View>
  )

  const NumInput = ({
    label,
    value,
    onChangeText,
    unit,
  }: {
    label: string
    value: string
    onChangeText: (v: string) => void
    unit?: string
  }) => (
    <View style={styles.numRow}>
      <Text style={[styles.numLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.numInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          style={[styles.numInput, { color: colors.foreground }]}
          placeholderTextColor={colors.mutedForeground}
        />
        {unit ? <Text style={[styles.numUnit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
      </View>
    </View>
  )

  const topInset = Platform.OS === 'web' ? 67 : insets.top

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topInset + 16,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={MOD.primary}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <MaterialCommunityIcons name="scale-bathroom" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Weight</Text>
        </View>
        {latest ? (
          <View style={styles.latestWrap}>
            <Text style={[styles.latestValue, { color: colors.foreground }]}>
              {latest.trueWeightKg} kg
            </Text>
            {delta ? (
              <Text
                style={[
                  styles.latestDelta,
                  { color: parseFloat(delta) < 0 ? colors.success : colors.foreground },
                ]}
              >
                {parseFloat(delta) > 0 ? '+' : ''}
                {delta}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Form card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Scale weight */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Scale weight</Text>
        <View style={styles.bigInputRow}>
          <Pressable
            onPress={() => {
              const v = parseFloat(form.scaleKg) || 0
              setForm((f) => ({ ...f, scaleKg: Math.max(0, v - 0.1).toFixed(1) }))
            }}
            style={[styles.stepBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="minus" size={18} color={colors.foreground} />
          </Pressable>
          <TextInput
            value={form.scaleKg}
            onChangeText={(v) => setForm((f) => ({ ...f, scaleKg: v }))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.bigInput, { color: colors.foreground }]}
          />
          <Text style={[styles.bigUnit, { color: colors.mutedForeground }]}>kg</Text>
          <Pressable
            onPress={() => {
              const v = parseFloat(form.scaleKg) || 0
              setForm((f) => ({ ...f, scaleKg: (v + 0.1).toFixed(1) }))
            }}
            style={[styles.stepBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="plus" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Quick toggles */}
        <View style={styles.quickToggles}>
          <ToggleRow
            label="Morning reading"
            value={form.morningReading}
            onToggle={(v) => setForm((f) => ({ ...f, morningReading: v }))}
          />
          <ToggleRow
            label="Hard training"
            value={form.hardTraining}
            onToggle={(v) => setForm((f) => ({ ...f, hardTraining: v }))}
          />
        </View>

        {/* Advanced context */}
        <Pressable
          onPress={() => setShowAdvanced((s) => !s)}
          style={styles.expandBtn}
        >
          <Text style={[styles.expandLabel, { color: MOD.primary }]}>
            {showAdvanced ? 'Hide' : 'Show'} context
          </Text>
          <Feather
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={MOD.primary}
          />
        </Pressable>

        {showAdvanced && (
          <View style={styles.advancedSection}>
            <NumInput
              label="Creatine dose"
              value={form.creatineDoseG}
              onChangeText={(v) => setForm((f) => ({ ...f, creatineDoseG: v }))}
              unit="g"
            />
            <NumInput
              label="Days on creatine"
              value={form.creatineDaysOn}
              onChangeText={(v) => setForm((f) => ({ ...f, creatineDaysOn: v }))}
            />
            <NumInput
              label="Alcohol units"
              value={form.alcoholUnits}
              onChangeText={(v) => setForm((f) => ({ ...f, alcoholUnits: v }))}
            />
            <NumInput
              label="Hours since alcohol"
              value={form.hoursSinceAlcohol}
              onChangeText={(v) => setForm((f) => ({ ...f, hoursSinceAlcohol: v }))}
            />
            <NumInput
              label="Carbs yesterday"
              value={form.carbsG}
              onChangeText={(v) => setForm((f) => ({ ...f, carbsG: v }))}
              unit="g"
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ToggleRow
              label="High sodium"
              value={form.highSodium}
              onToggle={(v) => setForm((f) => ({ ...f, highSodium: v }))}
            />
            <ToggleRow
              label="Restaurant meal"
              value={form.restaurantMeal}
              onToggle={(v) => setForm((f) => ({ ...f, restaurantMeal: v }))}
            />
            <ToggleRow
              label="Flight day"
              value={form.flightDay}
              onToggle={(v) => setForm((f) => ({ ...f, flightDay: v }))}
            />
            <ToggleRow
              label="Illness"
              value={form.illnessDay}
              onToggle={(v) => setForm((f) => ({ ...f, illnessDay: v }))}
            />
          </View>
        )}

        {/* Tanita */}
        <Pressable
          onPress={() => setShowTanita((s) => !s)}
          style={styles.expandBtn}
        >
          <Text style={[styles.expandLabel, { color: MOD.primary }]}>
            {showTanita ? 'Hide' : 'Show'} body comp (Tanita)
          </Text>
          <Feather
            name={showTanita ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={MOD.primary}
          />
        </Pressable>

        {showTanita && (
          <View style={styles.advancedSection}>
            <NumInput
              label="Body fat"
              value={form.bodyFatPct}
              onChangeText={(v) => setForm((f) => ({ ...f, bodyFatPct: v }))}
              unit="%"
            />
            <NumInput
              label="Muscle mass"
              value={form.muscleMassKg}
              onChangeText={(v) => setForm((f) => ({ ...f, muscleMassKg: v }))}
              unit="kg"
            />
            <NumInput
              label="Bone mass"
              value={form.boneMassKg}
              onChangeText={(v) => setForm((f) => ({ ...f, boneMassKg: v }))}
              unit="kg"
            />
            <NumInput
              label="Body water"
              value={form.bodyWaterPct}
              onChangeText={(v) => setForm((f) => ({ ...f, bodyWaterPct: v }))}
              unit="%"
            />
            <NumInput
              label="Visceral fat"
              value={form.visceralFat}
              onChangeText={(v) => setForm((f) => ({ ...f, visceralFat: v }))}
            />
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
            <Text style={styles.submitText}>Log weight</Text>
          )}
        </Pressable>
      </View>

      {/* Chart */}
      {isLoading ? (
        <ActivityIndicator color={MOD.primary} style={{ marginTop: 24 }} />
      ) : chartData.length > 1 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>30-day trend</Text>
          <Text style={[styles.chartLegend, { color: colors.mutedForeground }]}>
            <Text style={{ color: colors.mutedForeground }}>— </Text>Scale
            {'   '}
            <Text style={{ color: MOD.primary }}>— </Text>True weight
          </Text>
          <LineChart
            data={chartData}
            data2={chartData2}
            color={isDark ? '#94a3b8' : '#94a3b8'}
            color2={MOD.primary}
            thickness={1.5}
            thickness2={2.5}
            noOfSections={4}
            width={chartW - 32}
            spacing={chartData.length > 20 ? (chartW - 80) / chartData.length : 18}
            initialSpacing={8}
            endSpacing={8}
            yAxisLabelWidth={44}
            yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.border}
            hideDataPoints
            hideDataPoints2={false}
            dataPointsColor2={MOD.primary}
            dataPointsRadius2={3}
            areaChart
            startFillColor={`${MOD.primary}30`}
            endFillColor={`${MOD.primary}05`}
            startOpacity={0.3}
            endOpacity={0.05}
          />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="scale-bathroom" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No entries yet. Log your first weight above.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  moduleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  moduleLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  latestWrap: { alignItems: 'flex-end' },
  latestValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  latestDelta: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  bigInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigInput: {
    flex: 1,
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  bigUnit: { fontSize: 18, fontFamily: 'Inter_500Medium' },
  quickToggles: { gap: 4, marginBottom: 8 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  expandLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  advancedSection: { gap: 4, paddingBottom: 8 },
  numRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  numLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  numInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    minWidth: 80,
  },
  numInput: { fontSize: 14, fontFamily: 'Inter_400Regular', minWidth: 40, textAlign: 'right' },
  numUnit: { fontSize: 12, marginLeft: 4 },
  divider: { height: 1, marginVertical: 8 },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  chartLegend: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_400Regular' },
})
