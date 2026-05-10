import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import React, { useState, useEffect } from 'react'
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
import { BarChart } from 'react-native-gifted-charts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather, Ionicons } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

const MOD = MODULE_COLORS.food
const TARGETS_KEY = '@mypens/food_targets'
const today = () => new Date().toISOString().split('T')[0]

interface FoodEntry {
  id: string
  date: string
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  notes?: string
}

interface Targets { kcal: number; proteinG: number; carbsG: number; fatG: number }

const MEAL_OPTIONS: FoodEntry['meal'][] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_ICONS: Record<FoodEntry['meal'], string> = {
  breakfast: 'coffee',
  lunch: 'sun',
  dinner: 'moon',
  snack: 'package',
}

const defaultTargets: Targets = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 70 }

export default function FoodScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()

  const [selectedDate, setSelectedDate] = useState(today())
  const [selectedMeal, setSelectedMeal] = useState<FoodEntry['meal']>('breakfast')
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [proteinG, setProteinG] = useState('')
  const [carbsG, setCarbsG] = useState('')
  const [fatG, setFatG] = useState('')
  const [fiberG, setFiberG] = useState('')
  const [notes, setNotes] = useState('')
  const [detailed, setDetailed] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [targets, setTargets] = useState<Targets>(defaultTargets)
  const [targetKcal, setTargetKcal] = useState('2000')
  const [targetProtein, setTargetProtein] = useState('150')
  const [targetCarbs, setTargetCarbs] = useState('200')
  const [targetFat, setTargetFat] = useState('70')

  useEffect(() => {
    AsyncStorage.getItem(TARGETS_KEY).then((raw) => {
      if (raw) {
        const t = JSON.parse(raw) as Targets
        setTargets(t)
        setTargetKcal(String(t.kcal))
        setTargetProtein(String(t.proteinG))
        setTargetCarbs(String(t.carbsG))
        setTargetFat(String(t.fatG))
      }
    })
  }, [])

  const saveTargets = async () => {
    const t: Targets = {
      kcal: parseInt(targetKcal) || 2000,
      proteinG: parseInt(targetProtein) || 150,
      carbsG: parseInt(targetCarbs) || 200,
      fatG: parseInt(targetFat) || 70,
    }
    await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(t))
    setTargets(t)
    setShowTargets(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery<FoodEntry[]>({
    queryKey: ['food', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('FoodEntry')
        .select('*')
        .eq('date', selectedDate)
        .order('createdAt', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: chartEntries = [] } = useQuery<FoodEntry[]>({
    queryKey: ['food-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('FoodEntry')
        .select('date, kcal, proteinG')
        .order('date', { ascending: true })
        .limit(90)
      if (error) throw error
      return data ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Enter a food name')
      if (!kcal) throw new Error('Enter calories')
      const { error } = await supabase.from('FoodEntry').insert({
        date: selectedDate,
        meal: selectedMeal,
        name: name.trim(),
        kcal: parseInt(kcal),
        proteinG: parseFloat(proteinG) || 0,
        carbsG: parseFloat(carbsG) || 0,
        fatG: parseFloat(fatG) || 0,
        fiberG: parseFloat(fiberG) || 0,
        notes: notes.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['food'] })
      setName('')
      setKcal('')
      setProteinG('')
      setCarbsG('')
      setFatG('')
      setFiberG('')
      setNotes('')
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('FoodEntry').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      qc.invalidateQueries({ queryKey: ['food'] })
    },
  })

  // Totals for today
  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )

  // Daily kcal chart (last 14 days)
  const dailyMap = new Map<string, number>()
  chartEntries.forEach((e) => {
    dailyMap.set(e.date, (dailyMap.get(e.date) ?? 0) + e.kcal)
  })
  const last14 = [...dailyMap.entries()].slice(-14)
  const barData = last14.map(([d, v]) => ({
    value: v,
    label: new Date(d).toLocaleDateString('en', { weekday: 'narrow' }),
    frontColor: v >= targets.kcal * 0.9 && v <= targets.kcal * 1.1 ? MOD.primary : `${MOD.primary}70`,
  }))

  const MacroBar = ({ label, current, target, color }: { label: string; current: number; target: number; color: string }) => {
    const pct = Math.min(current / target, 1)
    return (
      <View style={styles.macroBarWrap}>
        <View style={styles.macroBarRow}>
          <Text style={[styles.macroBarLabel, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[styles.macroBarVal, { color: colors.foreground }]}>
            {Math.round(current)}/{target}
          </Text>
        </View>
        <View style={[styles.macroBarBg, { backgroundColor: colors.border }]}>
          <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  const grouped = MEAL_OPTIONS.reduce(
    (acc, meal) => {
      acc[meal] = entries.filter((e) => e.meal === meal)
      return acc
    },
    {} as Record<FoodEntry['meal'], FoodEntry[]>,
  )

  const chartW = width - 48
  const accentBg = isDark ? MOD.bgDark : MOD.bg
  const topInset = Platform.OS === 'web' ? 67 : insets.top

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
          <Ionicons name="restaurant-outline" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Food</Text>
        </View>
        <Pressable onPress={() => setShowTargets((s) => !s)}>
          <Feather name="settings" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Targets settings */}
      {showTargets && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Daily targets</Text>
          {[
            { label: 'Calories', value: targetKcal, set: setTargetKcal, unit: 'kcal' },
            { label: 'Protein', value: targetProtein, set: setTargetProtein, unit: 'g' },
            { label: 'Carbs', value: targetCarbs, set: setTargetCarbs, unit: 'g' },
            { label: 'Fat', value: targetFat, set: setTargetFat, unit: 'g' },
          ].map(({ label, value, set, unit }) => (
            <View key={label} style={styles.targetRow}>
              <Text style={[styles.targetLabel, { color: colors.foreground }]}>{label}</Text>
              <View style={[styles.numInputWrap, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <TextInput
                  value={value}
                  onChangeText={set}
                  keyboardType="number-pad"
                  style={[styles.numInput, { color: colors.foreground }]}
                />
                <Text style={[styles.numUnit, { color: colors.mutedForeground }]}>{unit}</Text>
              </View>
            </View>
          ))}
          <Pressable
            onPress={saveTargets}
            style={[styles.submitBtn, { backgroundColor: MOD.primary }]}
          >
            <Text style={styles.submitText}>Save targets</Text>
          </Pressable>
        </View>
      )}

      {/* Macro progress */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {new Date(selectedDate).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        <MacroBar label="Calories" current={totals.kcal} target={targets.kcal} color={MOD.primary} />
        <MacroBar label="Protein" current={totals.proteinG} target={targets.proteinG} color="#3b82f6" />
        <MacroBar label="Carbs" current={totals.carbsG} target={targets.carbsG} color="#f97316" />
        <MacroBar label="Fat" current={totals.fatG} target={targets.fatG} color="#eab308" />
      </View>

      {/* Entry form */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add food</Text>

        {/* Meal picker */}
        <View style={styles.mealRow}>
          {MEAL_OPTIONS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setSelectedMeal(m)}
              style={[
                styles.mealChip,
                {
                  backgroundColor: selectedMeal === m ? MOD.primary : colors.secondary,
                  borderColor: selectedMeal === m ? MOD.primary : colors.border,
                },
              ]}
            >
              <Feather
                name={MEAL_ICONS[m] as any}
                size={14}
                color={selectedMeal === m ? '#fff' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.mealChipText,
                  { color: selectedMeal === m ? '#fff' : colors.mutedForeground },
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Food name"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        />

        <View style={styles.macroInputRow}>
          <View style={styles.macroInput}>
            <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>kcal</Text>
            <TextInput
              value={kcal}
              onChangeText={setKcal}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
          <View style={styles.macroInput}>
            <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>protein g</Text>
            <TextInput
              value={proteinG}
              onChangeText={setProteinG}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
        </View>

        <View style={styles.detailedToggleRow}>
          <Text style={[styles.detailedLabel, { color: colors.mutedForeground }]}>Detailed macros</Text>
          <Switch
            value={detailed}
            onValueChange={setDetailed}
            trackColor={{ true: MOD.primary, false: colors.border }}
            thumbColor={colors.card}
          />
        </View>

        {detailed && (
          <View style={styles.macroInputRow}>
            <View style={styles.macroInput}>
              <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>carbs g</Text>
              <TextInput
                value={carbsG}
                onChangeText={setCarbsG}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>fat g</Text>
              <TextInput
                value={fatG}
                onChangeText={setFatG}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
              />
            </View>
            <View style={styles.macroInput}>
              <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>fiber g</Text>
              <TextInput
                value={fiberG}
                onChangeText={setFiberG}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
              />
            </View>
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
            <Text style={styles.submitText}>Add food</Text>
          )}
        </Pressable>
      </View>

      {/* Today's log */}
      {isLoading ? (
        <ActivityIndicator color={MOD.primary} style={{ marginTop: 8 }} />
      ) : (
        MEAL_OPTIONS.map((meal) =>
          grouped[meal].length > 0 ? (
            <View key={meal} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.mealHeader, { color: MOD.primary }]}>
                {meal.charAt(0).toUpperCase() + meal.slice(1)}
              </Text>
              {grouped[meal].map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, { color: colors.foreground }]}>{e.name}</Text>
                    <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
                      {e.kcal} kcal · {e.proteinG}g P
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => deleteMutation.mutate(e.id)}
                    hitSlop={12}
                  >
                    <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null,
        )
      )}

      {/* Trend chart */}
      {barData.length > 1 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>14-day calorie trend</Text>
          <BarChart
            data={barData}
            barWidth={Math.max(12, (chartW - 80) / barData.length - 4)}
            spacing={4}
            noOfSections={4}
            width={chartW - 32}
            yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.border}
            yAxisLabelWidth={44}
            referenceLine1Config={{ color: MOD.primary, dashWidth: 4, dashGap: 4, labelText: `${targets.kcal}`, labelTextStyle: { color: MOD.primary, fontSize: 10 } }}
            referenceLine1Position={targets.kcal}
            initialSpacing={8}
          />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  moduleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  moduleLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  mealRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  mealChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  mealChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  input: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 15, marginBottom: 10 },
  macroInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  macroInput: { flex: 1 },
  macroInputLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 4 },
  macroInputField: { borderWidth: 1, borderRadius: 8, height: 38, paddingHorizontal: 8, fontSize: 14, textAlign: 'center' },
  detailedToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  detailedLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  macroBarWrap: { marginBottom: 10 },
  macroBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroBarLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  macroBarVal: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  macroBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 6, borderRadius: 3 },
  mealHeader: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8, textTransform: 'capitalize' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e2e8f010' },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  entrySub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  targetLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  numInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 36, minWidth: 80 },
  numInput: { fontSize: 14, fontFamily: 'Inter_400Regular', minWidth: 40, textAlign: 'right' },
  numUnit: { fontSize: 12, marginLeft: 4 },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
})
