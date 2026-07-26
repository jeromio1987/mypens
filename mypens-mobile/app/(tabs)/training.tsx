import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import React, { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BarChart } from 'react-native-gifted-charts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { usePensSync } from '@/hooks/usePensSync'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/generateId'
import { pensFetch, isPensApiConfigured } from '@/lib/pensApi'
import { enqueueOp, flushOfflineQueue } from '@/lib/offlineQueue'
import { PlannerWeekCard } from '@/components/PlannerWeekCard'
import { GarminPullCard } from '@/components/GarminPullCard'
import { OrphanActivitiesBanner } from '@/components/OrphanActivitiesBanner'
import { TrainingReviewCard } from '@/components/TrainingReviewCard'
import { HealthConnectCard } from '@/components/HealthConnectCard'

const MOD = MODULE_COLORS.training
const EXERCISES_KEY = '@mypens/recent_exercises'
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TrainingEntry {
  id: string
  date: string
  exercise: string
  sets: number
  reps: number
  weightKg: number
  rpe?: number
  notes?: string
  volume: number
}

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

export default function TrainingScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()
  const useApi = isPensApiConfigured()
  const { pending, online, refresh: refreshQueue } = usePensSync()
  const dayStr = today()

  const [exercise, setExercise] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('10')
  const [weightKg, setWeightKg] = useState('')
  const [rpe, setRpe] = useState<number | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [recentExercises, setRecentExercises] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(EXERCISES_KEY).then((raw) => {
      if (raw) setRecentExercises(JSON.parse(raw))
    })
  }, [])

  const saveExercise = async (name: string) => {
    const updated = [name, ...recentExercises.filter((e) => e !== name)].slice(0, 20)
    setRecentExercises(updated)
    await AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(updated))
  }

  const volume = (parseInt(sets) || 0) * (parseInt(reps) || 0) * (parseFloat(weightKg) || 0)

  const { data: todayEntries = [], isLoading, refetch, isRefetching } = useQuery<TrainingEntry[]>({
    queryKey: ['training', dayStr, useApi ? 'api' : 'supabase'],
    queryFn: async () => {
      if (useApi) {
        const r = await pensFetch(`/api/training?date=${encodeURIComponent(dayStr)}`)
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'Training fetch failed')
        }
        const data = await r.json()
        return Array.isArray(data) ? (data as TrainingEntry[]) : []
      }
      const { data, error } = await supabase
        .from('TrainingEntry')
        .select('*')
        .eq('date', dayStr)
        .order('createdAt', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const {
    data: weeklyEntries = [],
    refetch: refetchWeekly,
    isRefetching: isRefetchingWeekly,
  } = useQuery<TrainingEntry[]>({
    queryKey: ['training-weekly', useApi ? 'api' : 'supabase'],
    queryFn: async () => {
      if (useApi) {
        const r = await pensFetch('/api/training')
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'Training list failed')
        }
        const data = await r.json()
        if (!Array.isArray(data)) return []
        return (data as TrainingEntry[]).map((e) => ({
          id: e.id,
          date: e.date,
          exercise: e.exercise,
          sets: e.sets,
          reps: e.reps,
          weightKg: e.weightKg,
          rpe: e.rpe,
          notes: e.notes,
          volume: e.volume,
        }))
      }
      const { data, error } = await supabase
        .from('TrainingEntry')
        .select('date, volume, id, exercise, sets, reps, weightKg, rpe, notes')
        .order('date', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data ?? []) as TrainingEntry[]
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!exercise.trim()) throw new Error('Enter an exercise name')
      if (!weightKg) throw new Error('Enter weight')
      const s = parseInt(sets) || 1
      const rep = parseInt(reps) || 1
      const kg = parseFloat(weightKg)
      const payload: Record<string, unknown> = {
        date: dayStr,
        exercise: exercise.trim(),
        sets: s,
        reps: rep,
        weightKg: kg,
        notes: notes.trim() || undefined,
      }
      if (rpe != null) payload.rpe = Math.round(rpe)

      if (useApi) {
        if (!online) {
          await enqueueOp({ type: 'training_post', payload })
          await saveExercise(exercise.trim())
          await refreshQueue()
          return
        }
        try {
          const r = await pensFetch('/api/training', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Save failed')
          }
        } catch {
          await enqueueOp({ type: 'training_post', payload })
          await saveExercise(exercise.trim())
          await refreshQueue()
          return
        }
        await saveExercise(exercise.trim())
        return
      }

      const vol = s * rep * kg
      const { error } = await supabase.from('TrainingEntry').insert({
        id: generateId(),
        date: dayStr,
        exercise: exercise.trim(),
        sets: s,
        reps: rep,
        weightKg: kg,
        rpe: rpe != null ? Math.round(rpe) : null,
        notes: notes.trim() || null,
        volume: vol,
      })
      if (error) throw error
      await saveExercise(exercise.trim())
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (useApi) {
        await flushOfflineQueue()
        await refreshQueue()
      }
      qc.invalidateQueries({ queryKey: ['training'] })
      setExercise('')
      setWeightKg('')
      setRpe(undefined)
      setNotes('')
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const payload = { id }
      if (useApi) {
        if (!online) {
          await enqueueOp({ type: 'training_delete', payload })
          await refreshQueue()
          return
        }
        try {
          const r = await pensFetch('/api/training', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Delete failed')
          }
        } catch {
          await enqueueOp({ type: 'training_delete', payload })
          await refreshQueue()
          return
        }
        return
      }
      const { error } = await supabase.from('TrainingEntry').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      if (useApi) {
        await flushOfflineQueue()
        await refreshQueue()
      }
      qc.invalidateQueries({ queryKey: ['training'] })
    },
  })

  // Weekly volume (last 8 weeks)
  const weeklyMap = new Map<string, number>()
  weeklyEntries.forEach((e) => {
    const d = new Date(e.date)
    const startOfWeek = new Date(d)
    startOfWeek.setDate(d.getDate() - d.getDay())
    const key = startOfWeek.toISOString().split('T')[0]
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + e.volume)
  })
  const weekKeys = [...weeklyMap.keys()].sort().slice(-8)
  const barData = weekKeys.map((k, i) => ({
    value: Math.round(weeklyMap.get(k) ?? 0),
    label: i === weekKeys.length - 1 ? 'Now' : `W${i + 1}`,
    frontColor: i === weekKeys.length - 1 ? MOD.primary : `${MOD.primary}80`,
  }))

  const todayVolume = todayEntries.reduce((a, e) => a + e.volume, 0)
  const suggestions = recentExercises.filter((e) =>
    exercise.length > 0 ? e.toLowerCase().includes(exercise.toLowerCase()) : true,
  )

  const chartW = width - 48
  const accentBg = isDark ? MOD.bgDark : MOD.bg
  const topInset = Platform.OS === 'web' ? 67 : insets.top

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: insets.bottom + 100 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || isRefetchingWeekly}
          onRefresh={() => {
            void refetch()
            void refetchWeekly()
          }}
          tintColor={MOD.primary}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <MaterialCommunityIcons name="weight-lifter" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Training</Text>
        </View>
        {todayVolume > 0 && (
          <View style={styles.volumeWrap}>
            <Text style={[styles.volumeValue, { color: colors.foreground }]}>
              {Math.round(todayVolume).toLocaleString()} kg
            </Text>
            <Text style={[styles.volumeSub, { color: colors.mutedForeground }]}>today's volume</Text>
          </View>
        )}
      </View>

      <HealthConnectCard />
      <OrphanActivitiesBanner />
      <GarminPullCard days={7} />
      <TrainingReviewCard defaultDays={14} />
      <PlannerWeekCard />

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

      {/* Form */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Log set</Text>

        {/* Exercise input with autocomplete */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Exercise</Text>
          <TextInput
            value={exercise}
            onChangeText={(v) => { setExercise(v); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="e.g. Squat, Bench press"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
          />
          {showSuggestions && suggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {suggestions.slice(0, 5).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { setExercise(s); setShowSuggestions(false) }}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Sets / Reps / Weight */}
        <View style={styles.setsRow}>
          <View style={styles.setsField}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Sets</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => setSets((s) => String(Math.max(1, parseInt(s) - 1)))} style={[styles.stepBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="minus" size={14} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.stepValue, { color: colors.foreground }]}>{sets}</Text>
              <Pressable onPress={() => setSets((s) => String(parseInt(s) + 1))} style={[styles.stepBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="plus" size={14} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <View style={styles.setsField}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Reps</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => setReps((s) => String(Math.max(1, parseInt(s) - 1)))} style={[styles.stepBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="minus" size={14} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.stepValue, { color: colors.foreground }]}>{reps}</Text>
              <Pressable onPress={() => setReps((s) => String(parseInt(s) + 1))} style={[styles.stepBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="plus" size={14} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.setsField, { flex: 1.5 }]}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Weight (kg)</Text>
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.weightInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
        </View>

        {/* Live volume preview */}
        {volume > 0 && (
          <View style={[styles.volumePreview, { backgroundColor: accentBg }]}>
            <Text style={[styles.volumePreviewLabel, { color: MOD.primary }]}>Volume</Text>
            <Text style={[styles.volumePreviewValue, { color: MOD.primary }]}>
              {Math.round(volume).toLocaleString()} kg
            </Text>
          </View>
        )}

        {/* RPE */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>RPE (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={styles.rpeRow}>
            {RPE_OPTIONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRpe(rpe === r ? undefined : r)}
                style={[
                  styles.rpeChip,
                  {
                    backgroundColor: rpe === r ? MOD.primary : colors.secondary,
                    borderColor: rpe === r ? MOD.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: rpe === r ? '#fff' : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        />

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
            <Text style={styles.submitText}>Log set</Text>
          )}
        </Pressable>
      </View>

      {/* Today's session */}
      {isLoading ? (
        <ActivityIndicator color={MOD.primary} style={{ marginTop: 8 }} />
      ) : todayEntries.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's session</Text>
          {todayEntries.map((e) => (
            <View key={e.id} style={[styles.sessionRow, { borderTopColor: colors.border }]}>
              <View style={styles.sessionInfo}>
                <Text style={[styles.sessionExercise, { color: colors.foreground }]}>{e.exercise}</Text>
                <Text style={[styles.sessionDetail, { color: colors.mutedForeground }]}>
                  {e.sets} × {e.reps} @ {e.weightKg}kg
                  {e.rpe ? ` · RPE ${e.rpe}` : ''}
                </Text>
              </View>
              <View style={styles.sessionRight}>
                <Text style={[styles.sessionVolume, { color: MOD.primary }]}>
                  {Math.round(e.volume).toLocaleString()}
                </Text>
                <Pressable onPress={() => deleteMutation.mutate(e.id)} hitSlop={12}>
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Weekly volume chart */}
      {barData.length > 1 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>Weekly volume (kg)</Text>
          <BarChart
            data={barData}
            barWidth={Math.max(16, (chartW - 80) / barData.length - 6)}
            spacing={6}
            noOfSections={4}
            width={chartW - 32}
            yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 11 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.border}
            yAxisLabelWidth={52}
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
  volumeWrap: { alignItems: 'flex-end' },
  volumeValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  volumeSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 15 },
  suggestions: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  suggestionText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  setsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  setsField: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, borderColor: '#e2e8f0', paddingHorizontal: 8, height: 44 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  weightInput: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  volumePreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  volumePreviewLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  volumePreviewValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  rpeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  rpeChip: { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  sessionInfo: { flex: 1 },
  sessionExercise: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sessionDetail: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionVolume: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
})
