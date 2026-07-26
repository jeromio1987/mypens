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
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LineChart } from 'react-native-gifted-charts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useColors } from '@/hooks/useColors'
import { usePensSync } from '@/hooks/usePensSync'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/generateId'
import { pensFetch, isPensApiConfigured } from '@/lib/pensApi'
import { enqueueOp, flushOfflineQueue } from '@/lib/offlineQueue'
import { HealthConnectSleepCard } from '@/components/HealthConnectSleepCard'
import { DateNavBar } from '@/components/DateNavBar'

const MOD = MODULE_COLORS.sleep
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface SleepEntry {
  id: string
  date: string
  bedtime: string
  wakeTime: string
  hours: number
  quality: number
  hrv?: number
  notes?: string
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

function calcHours(bedtime: string, wakeTime: string): number {
  const bed = parseTimeToMinutes(bedtime)
  const wake = parseTimeToMinutes(wakeTime)
  if (bed === 0 && wake === 0) return 0
  let diff = wake - bed
  if (diff <= 0) diff += 24 * 60
  return parseFloat((diff / 60).toFixed(2))
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useColors()
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} onPress={() => onChange(s)} hitSlop={8}>
          <Feather
            name="star"
            size={28}
            color={s <= value ? MOD.primary : colors.border}
          />
        </Pressable>
      ))}
    </View>
  )
}

export default function SleepScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const qc = useQueryClient()
  const useApi = isPensApiConfigured()
  const { pending, online, refresh: refreshQueue } = usePensSync()

  const [date, setDate] = useState(today())
  const [bedtime, setBedtime] = useState('23:00')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [quality, setQuality] = useState(3)
  const [hrv, setHrv] = useState('')
  const [notes, setNotes] = useState('')

  const hours = calcHours(bedtime, wakeTime)

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery<SleepEntry[]>({
    queryKey: ['sleep', useApi ? 'api' : 'supabase'],
    queryFn: async () => {
      if (useApi) {
        const r = await pensFetch('/api/sleep?limit=90')
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'Sleep fetch failed')
        }
        const rows = (await r.json()) as SleepEntry[]
        if (!Array.isArray(rows)) return []
        return [...rows].sort((a, b) => a.date.localeCompare(b.date))
      }
      const { data, error } = await supabase
        .from('SleepEntry')
        .select('*')
        .order('date', { ascending: true })
        .limit(60)
      if (error) throw error
      return data ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (hours <= 0) throw new Error('Enter valid bedtime and wake time')
      const payload: Record<string, unknown> = {
        date,
        bedtime,
        wakeTime,
        quality,
      }
      if (hrv.trim()) payload.hrv = parseFloat(hrv)
      if (notes.trim()) payload.notes = notes.trim()

      if (useApi) {
        if (!online) {
          await enqueueOp({ type: 'sleep_post', payload })
          await refreshQueue()
          return
        }
        try {
          const r = await pensFetch('/api/sleep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) {
            const t = await r.text()
            throw new Error(t || 'Save failed')
          }
        } catch {
          await enqueueOp({ type: 'sleep_post', payload })
          await refreshQueue()
          return
        }
        return
      }

      const { error } = await supabase.from('SleepEntry').upsert({
        id: generateId(),
        date,
        bedtime,
        wakeTime,
        hours,
        quality,
        hrv: hrv ? parseFloat(hrv) : null,
        notes: notes.trim() || null,
      }, { onConflict: 'date' })
      if (error) throw error
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (useApi) {
        await flushOfflineQueue()
        await refreshQueue()
      }
      qc.invalidateQueries({ queryKey: ['sleep'] })
      setNotes('')
      setHrv('')
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const last30 = entries.slice(-30)
  const chartData = last30.map((e) => ({ value: e.hours }))
  const qualityData = last30.map((e) => ({ value: e.quality }))

  const avg = entries.length
    ? (entries.slice(-7).reduce((a, e) => a + e.hours, 0) / Math.min(entries.slice(-7).length, 7)).toFixed(1)
    : null

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
          <Feather name="moon" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Sleep</Text>
        </View>
        {avg && (
          <View style={styles.avgWrap}>
            <Text style={[styles.avgValue, { color: colors.foreground }]}>{avg}h</Text>
            <Text style={[styles.avgSub, { color: colors.mutedForeground }]}>7-day avg</Text>
          </View>
        )}
      </View>

      {/* Weekly Feedback entry */}
      <Pressable
        onPress={() => router.push('/weekly-feedback')}
        style={({ pressed }) => ({
          marginHorizontal: 16,
          marginBottom: 12,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: isDark ? '#164e63' : '#a5f3fc',
          backgroundColor: isDark ? 'rgba(6,182,212,0.12)' : '#ecfeff',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Feather name="activity" size={18} color="#06b6d4" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.foreground }}>
            Weekly Feedback
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
            Your health + how you worked with Claude this week
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

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

      <HealthConnectSleepCard
        onSynced={() => {
          void qc.invalidateQueries({ queryKey: ['sleep'] })
        }}
      />

      <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
        <DateNavBar
          date={date}
          onChange={setDate}
          accent={MOD.primary}
          recentDates={entries.map((e) => e.date)}
        />
      </View>

      {/* Form */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Log sleep</Text>

        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Bedtime</Text>
            <TextInput
              value={bedtime}
              onChangeText={setBedtime}
              placeholder="23:00"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.timeInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
          <Feather name="arrow-right" size={20} color={colors.mutedForeground} style={{ marginTop: 24 }} />
          <View style={styles.timeField}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Wake time</Text>
            <TextInput
              value={wakeTime}
              onChangeText={setWakeTime}
              placeholder="07:00"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.timeInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
          <View style={styles.durationWrap}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Duration</Text>
            <Text style={[styles.durationValue, { color: hours > 0 ? MOD.primary : colors.mutedForeground }]}>
              {hours > 0 ? `${hours}h` : '--'}
            </Text>
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Quality</Text>
        <StarRating value={quality} onChange={setQuality} />

        <View style={styles.optionalRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>HRV (optional)</Text>
            <TextInput
              value={hrv}
              onChangeText={setHrv}
              keyboardType="decimal-pad"
              placeholder="ms"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.smallInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
          <View style={{ flex: 2, marginLeft: 12 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.smallInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
          </View>
        </View>

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
            <Text style={styles.submitText}>Log sleep</Text>
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
            <Text style={{ color: MOD.primary }}>— </Text>Duration (h)
            {'   '}
            <Text style={{ color: '#94a3b8' }}>— </Text>Quality (/5)
          </Text>
          <LineChart
            data={chartData}
            data2={qualityData}
            color={MOD.primary}
            color2="#94a3b8"
            thickness={2.5}
            thickness2={1.5}
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
            areaChart
            startFillColor={`${MOD.primary}30`}
            endFillColor={`${MOD.primary}05`}
          />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="moon" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No sleep logged yet.
          </Text>
        </View>
      ) : null}

      {/* Recent entries */}
      {entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent</Text>
          {entries.slice(-5).reverse().map((e) => (
            <View key={e.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.entryDate, { color: colors.foreground }]}>
                  {new Date(e.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
                  {e.bedtime} → {e.wakeTime}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.entryHours, { color: MOD.primary }]}>{e.hours}h</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Feather key={s} name="star" size={10} color={s <= e.quality ? MOD.primary : colors.border} />
                  ))}
                </View>
              </View>
            </View>
          ))}
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
  avgWrap: { alignItems: 'flex-end' },
  avgValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  avgSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  timeField: { flex: 1 },
  timeInput: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  durationWrap: { alignItems: 'center', paddingBottom: 4 },
  durationValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  optionalRow: { flexDirection: 'row', marginTop: 12, marginBottom: 4 },
  smallInput: { borderWidth: 1, borderRadius: 10, height: 40, paddingHorizontal: 10, fontSize: 14 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  chartTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  chartLegend: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_400Regular' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  entryDate: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  entrySub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  entryHours: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
})
