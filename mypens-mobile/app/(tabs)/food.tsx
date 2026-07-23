import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
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
import {
  pensFetch,
  isPensApiConfigured,
  pensApiBaseUrl,
  probePensApi,
  describePensError,
  type PensApiProbe,
} from '@/lib/pensApi'
import { enqueueOp, flushOfflineQueue } from '@/lib/offlineQueue'
import { usePensSync } from '@/hooks/usePensSync'
import { defaultEatenGrams, scalePortion } from '@/lib/foodPortion'

const MOD = MODULE_COLORS.food
const TARGETS_KEY = '@mypens/food_targets'
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

interface ScanItem {
  name: string
  meal: FoodEntry['meal']
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  brand?: string | null
  packGrams?: number | null
  assumedGrams?: number | null
  portionGrams?: number | null
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
  const { online, refresh: refreshQueue } = usePensSync()

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

  const [aiBusy, setAiBusy] = useState(false)
  const [scanItems, setScanItems] = useState<ScanItem[]>([])
  const [eatenGrams, setEatenGrams] = useState<number[]>([])
  const [dishSummary, setDishSummary] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<string | null>(null)
  const [anthropicFileId, setAnthropicFileId] = useState<string | null>(null)
  const [priorJson, setPriorJson] = useState<string | null>(null)
  const [refineText, setRefineText] = useState('')
  const [productHits, setProductHits] = useState<
    Array<{
      id: string
      source: 'history' | 'openfoodfacts'
      name: string
      brand: string | null
      packGrams: number | null
      assumedGrams: number | null
      kcal: number
      proteinG: number
      carbsG: number
      fatG: number
      fiberG: number
    }>
  >([])
  const [catalogPick, setCatalogPick] = useState<(typeof productHits)[0] | null>(null)
  const [catalogEatenG, setCatalogEatenG] = useState(100)
  const [apiProbe, setApiProbe] = useState<PensApiProbe | null>(null)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isPensApiConfigured()) {
      setApiProbe({ status: 'unconfigured' })
      return
    }
    let cancelled = false
    void (async () => {
      const result = await probePensApi()
      if (!cancelled) setApiProbe(result)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isPensApiConfigured() || name.trim().length < 2) {
      setProductHits([])
      setProductSearchError(null)
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await pensFetch(`/api/food/products?q=${encodeURIComponent(name.trim())}`)
          if (!res.ok) {
            setProductHits([])
            if (res.status === 401) {
              setProductSearchError(
                'Unauthorized — set MOBILE_PENS_API_TOKEN in Next .env to match EXPO_PUBLIC_PENS_API_TOKEN, then restart Next.',
              )
            } else {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setProductSearchError(j.error ?? `Product search failed (${res.status})`)
            }
            return
          }
          const j = (await res.json()) as { products?: typeof productHits }
          setProductHits(Array.isArray(j.products) ? j.products.slice(0, 8) : [])
          setProductSearchError(null)
        } catch (e: unknown) {
          setProductHits([])
          setProductSearchError(describePensError(e))
        }
      })()
    }, 300)
    return () => clearTimeout(t)
  }, [name])

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
      const res = await pensFetch(`/api/food?date=${encodeURIComponent(selectedDate)}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `Food fetch ${res.status}`)
      }
      const data = await res.json()
      return Array.isArray(data) ? data : []
    },
    enabled: isPensApiConfigured(),
  })

  const { data: chartEntries = [] } = useQuery<FoodEntry[]>({
    queryKey: ['food-chart'],
    queryFn: async () => {
      const res = await pensFetch('/api/food')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `Food chart ${res.status}`)
      }
      const data = await res.json()
      const list = Array.isArray(data) ? (data as FoodEntry[]) : []
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      return list.filter((e) => e.date >= cutoffStr)
    },
    enabled: isPensApiConfigured(),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Enter a food name')
      const payload = {
        date: selectedDate,
        meal: selectedMeal,
        name: name.trim(),
        kcal: parseInt(kcal, 10) || 0,
        proteinG: parseFloat(proteinG) || 0,
        carbsG: parseFloat(carbsG) || 0,
        fatG: parseFloat(fatG) || 0,
        fiberG: parseFloat(fiberG) || 0,
        notes: notes.trim() || undefined,
      }
      if (!online) {
        await enqueueOp({ type: 'food_post', payload })
        return
      }
      try {
        const res = await pensFetch('/api/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Save failed')
      } catch {
        await enqueueOp({ type: 'food_post', payload })
      }
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await flushOfflineQueue()
      await refreshQueue()
      qc.invalidateQueries({ queryKey: ['food'] })
      qc.invalidateQueries({ queryKey: ['food-chart'] })
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
      const payload = { id }
      if (!online) {
        await enqueueOp({ type: 'food_delete', payload })
        return
      }
      try {
        const res = await pensFetch('/api/food', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Delete failed')
      } catch {
        await enqueueOp({ type: 'food_delete', payload })
      }
    },
    onSuccess: async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await flushOfflineQueue()
      await refreshQueue()
      qc.invalidateQueries({ queryKey: ['food'] })
      qc.invalidateQueries({ queryKey: ['food-chart'] })
    },
  })

  const checkApiOrAlert = () => {
    if (!isPensApiConfigured()) {
      Alert.alert('API not configured', 'Set EXPO_PUBLIC_PENS_API_URL and EXPO_PUBLIC_PENS_API_TOKEN in mypens-mobile/.env, then restart Expo.')
      return false
    }
    return true
  }

  const pickAndScan = async () => {
    if (!checkApiOrAlert()) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to scan food.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 })
    await runScan(result)
  }

  const takeAndScan = async () => {
    if (!checkApiOrAlert()) return
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access to scan food.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
    await runScan(result)
  }

  const runScan = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setAiBusy(true)
    setScanItems([])
    setEatenGrams([])
    setDishSummary(null)
    setAnalysisMode(null)
    setAnthropicFileId(null)
    setPriorJson(null)
    try {
      const form = new FormData()
      const mime = asset.mimeType ?? 'image/jpeg'
      const ext = mime.includes('png') ? 'png' : 'jpg'
      form.append('file', {
        uri: asset.uri,
        name: `scan.${ext}`,
        type: mime,
      } as unknown as Blob)
      form.append('date', selectedDate)
      form.append('meal', selectedMeal)
      const res = await pensFetch('/api/food/photo-analyze', { method: 'POST', body: form })
      const j = (await res.json()) as {
        error?: string
        items?: ScanItem[]
        dishSummary?: string
        analysisMode?: string
        anthropicFileId?: string | null
      }
      if (!res.ok) throw new Error(j.error ?? `Scan failed (${res.status})`)
      const items = Array.isArray(j.items) ? j.items : []
      setScanItems(items)
      setEatenGrams(items.map(defaultEatenGrams))
      setDishSummary(typeof j.dishSummary === 'string' ? j.dishSummary : null)
      setAnalysisMode(typeof j.analysisMode === 'string' ? j.analysisMode : null)
      const fid = j.anthropicFileId != null ? String(j.anthropicFileId) : null
      setAnthropicFileId(fid && fid.length > 0 ? fid : null)
      setPriorJson(JSON.stringify({
        analysisMode: j.analysisMode ?? 'meal_estimate',
        dishSummary: j.dishSummary ?? '',
        items,
      }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e: unknown) {
      Alert.alert('Photo scan', describePensError(e))
    } finally {
      setAiBusy(false)
    }
  }

  const runRefine = async () => {
    if (!isPensApiConfigured() || !anthropicFileId || !priorJson || !refineText.trim()) return
    setAiBusy(true)
    try {
      const res = await pensFetch('/api/food/photo-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anthropicFileId,
          date: selectedDate,
          meal: selectedMeal,
          priorAssistantText: priorJson,
          refine: refineText.trim(),
        }),
      })
      const j = (await res.json()) as {
        error?: string
        items?: ScanItem[]
        dishSummary?: string
        analysisMode?: string
        anthropicFileId?: string | null
      }
      if (!res.ok) throw new Error(j.error ?? `Refine failed (${res.status})`)
      const items = Array.isArray(j.items) ? j.items : []
      setScanItems(items)
      setEatenGrams(items.map(defaultEatenGrams))
      setDishSummary(typeof j.dishSummary === 'string' ? j.dishSummary : null)
      setAnalysisMode(typeof j.analysisMode === 'string' ? j.analysisMode : null)
      setRefineText('')
      setPriorJson(JSON.stringify({
        analysisMode: j.analysisMode ?? 'meal_estimate',
        dishSummary: j.dishSummary ?? '',
        items,
      }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e: unknown) {
      Alert.alert('Refine', describePensError(e))
    } finally {
      setAiBusy(false)
    }
  }

  const applyScanRow = (index: number) => {
    const item = scanItems[index]
    if (!item) return
    const scaled = scalePortion(
      {
        ...item,
        assumedGrams: item.assumedGrams ?? null,
        packGrams: item.packGrams ?? null,
      },
      eatenGrams[index] ?? defaultEatenGrams(item),
    )
    const g = scaled.eatenGrams
    setSelectedMeal(item.meal)
    setName(
      g > 0
        ? `${item.brand ? `${item.brand} · ` : ''}${item.name} (${Math.round(g)}g)`
        : item.name,
    )
    setKcal(scaled.kcal ? String(Math.round(scaled.kcal)) : '')
    setProteinG(scaled.proteinG ? String(scaled.proteinG) : '')
    setCarbsG(scaled.carbsG ? String(scaled.carbsG) : '')
    setFatG(scaled.fatG ? String(scaled.fatG) : '')
    setFiberG(scaled.fiberG ? String(scaled.fiberG) : '')
    setNotes(item.packGrams ? `Pack ${item.packGrams}g · ate ${Math.round(g)}g` : notes)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const logAllScan = async () => {
    if (!isPensApiConfigured() || scanItems.length === 0) return
    setAiBusy(true)
    try {
      for (let i = 0; i < scanItems.length; i++) {
        const item = scanItems[i]
        const scaled = scalePortion(
          {
            ...item,
            assumedGrams: item.assumedGrams ?? null,
            packGrams: item.packGrams ?? null,
          },
          eatenGrams[i] ?? defaultEatenGrams(item),
        )
        const g = scaled.eatenGrams
        const name =
          g > 0
            ? `${item.brand ? `${item.brand} · ` : ''}${item.name} (${Math.round(g)}g)`
            : item.name
        const res = await pensFetch('/api/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            meal: item.meal,
            name,
            kcal: scaled.kcal,
            proteinG: scaled.proteinG,
            carbsG: scaled.carbsG,
            fatG: scaled.fatG,
            fiberG: scaled.fiberG,
            notes:
              i === 0 && dishSummary
                ? `AI: ${dishSummary.slice(0, 160)}${item.packGrams ? ` · pack ${item.packGrams}g / ate ${Math.round(g)}g` : ''}`
                : item.packGrams
                  ? `Pack ${item.packGrams}g · ate ${Math.round(g)}g`
                  : undefined,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Save failed')
      }
      qc.invalidateQueries({ queryKey: ['food'] })
      qc.invalidateQueries({ queryKey: ['food-chart'] })
      setScanItems([])
      setEatenGrams([])
      setDishSummary(null)
      setAnalysisMode(null)
      setAnthropicFileId(null)
      setPriorJson(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e: unknown) {
      Alert.alert('Log all', e instanceof Error ? e.message : 'Failed')
    } finally {
      setAiBusy(false)
    }
  }

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )

  const dailyMap = new Map<string, number>()
  chartEntries.forEach((e) => {
    dailyMap.set(e.date, (dailyMap.get(e.date) ?? 0) + e.kcal)
  })
  const last14 = [...dailyMap.entries()].slice(-14)
  const barData = last14.map(([d, v]) => ({
    value: v,
    label: new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'narrow' }),
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
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <Ionicons name="restaurant-outline" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Food</Text>
        </View>
        <Pressable onPress={() => setShowTargets((s) => !s)}>
          <Feather name="settings" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {(!isPensApiConfigured() || (apiProbe && apiProbe.status !== 'ok')) && (
        <View style={[styles.warnCard, { borderColor: '#f59e0b', backgroundColor: colors.card }]}>
          <Text style={[styles.warnTitle, { color: colors.foreground }]}>
            {!isPensApiConfigured() || apiProbe?.status === 'unconfigured'
              ? 'Connect to MY PENS'
              : apiProbe?.status === 'server_token_missing'
                ? 'Next server token missing'
                : apiProbe?.status === 'unauthorized'
                  ? 'API token mismatch'
                  : 'Cannot reach MY PENS API'}
          </Text>
          <Text style={[styles.warnBody, { color: colors.mutedForeground }]}>
            {!isPensApiConfigured() || apiProbe?.status === 'unconfigured'
              ? 'Add EXPO_PUBLIC_PENS_API_URL and EXPO_PUBLIC_PENS_API_TOKEN to mypens-mobile/.env (token must match MOBILE_PENS_API_TOKEN on the Next server). Restart Expo after changing env.'
              : apiProbe?.status === 'server_token_missing'
                ? `Phone reaches ${apiProbe.baseUrl}, but Next reports hasMobileToken:false. Add MOBILE_PENS_API_TOKEN to C:\\Users\\jerom\\Desktop\\claude\\Projects\\mypens\\.env (same value as mobile EXPO_PUBLIC_PENS_API_TOKEN), then restart npm run dev.`
                : apiProbe?.status === 'unauthorized'
                  ? `Bearer rejected by ${apiProbe.baseUrl}. Make MOBILE_PENS_API_TOKEN (Next) identical to EXPO_PUBLIC_PENS_API_TOKEN (mobile), restart both.`
                  : apiProbe?.status === 'unreachable'
                    ? apiProbe.detail
                    : `Check ${pensApiBaseUrl() || 'EXPO_PUBLIC_PENS_API_URL'}/api/health on the phone browser.`}
          </Text>
        </View>
      )}

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
          <Pressable onPress={saveTargets} style={[styles.submitBtn, { backgroundColor: MOD.primary }]}>
            <Text style={styles.submitText}>Save targets</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={[styles.dateHint, { color: colors.mutedForeground }]}>Date (yyyy-mm-dd)</Text>
        <TextInput
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="2026-05-13"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary, marginBottom: 12 }]}
        />
        <MacroBar label="Calories" current={totals.kcal} target={targets.kcal} color={MOD.primary} />
        <MacroBar label="Protein" current={totals.proteinG} target={targets.proteinG} color="#3b82f6" />
        <MacroBar label="Carbs" current={totals.carbsG} target={targets.carbsG} color="#f97316" />
        <MacroBar label="Fat" current={totals.fatG} target={targets.fatG} color="#eab308" />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Photo (AI)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => void takeAndScan()}
            disabled={aiBusy || !isPensApiConfigured()}
            style={[styles.secondaryBtn, { flex: 1, borderColor: MOD.primary, opacity: aiBusy || !isPensApiConfigured() ? 0.5 : 1 }]}
          >
            {aiBusy ? (
              <ActivityIndicator color={MOD.primary} />
            ) : (
              <Text style={[styles.secondaryBtnText, { color: MOD.primary }]}>📷 Take photo</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void pickAndScan()}
            disabled={aiBusy || !isPensApiConfigured()}
            style={[styles.secondaryBtn, { flex: 1, borderColor: colors.border, opacity: aiBusy || !isPensApiConfigured() ? 0.5 : 1 }]}
          >
            <Text style={[styles.secondaryBtnText, { color: MOD.primary }]}>🖼 Choose photo</Text>
          </Pressable>
        </View>
        {analysisMode && (
          <Text style={[styles.aiMeta, { color: colors.mutedForeground }]}>Mode: {analysisMode}</Text>
        )}
        {dishSummary ? (
          <Text style={[styles.aiSummary, { color: colors.mutedForeground }]}>{dishSummary}</Text>
        ) : null}
        {scanItems.length > 0 && (
          <>
            {scanItems.map((item, idx) => {
              const scaled = scalePortion(
                {
                  ...item,
                  assumedGrams: item.assumedGrams ?? null,
                  packGrams: item.packGrams ?? null,
                },
                eatenGrams[idx] ?? defaultEatenGrams(item),
              )
              const eaten = eatenGrams[idx] ?? defaultEatenGrams(item)
              return (
                <View key={`${item.name}-${idx}`} style={[styles.scanRow, { borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.entryName, { color: colors.foreground }]}>
                        {item.brand ? `${item.brand} · ` : ''}
                        {item.name}
                      </Text>
                      <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
                        {Math.round(scaled.kcal)} kcal · P {scaled.proteinG}g
                        {item.packGrams ? ` · pack ${item.packGrams}g` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => applyScanRow(idx)} style={styles.scanApply}>
                      <Text style={{ color: MOD.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Fill</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>Grams</Text>
                    <TextInput
                      value={String(Math.round(eaten))}
                      onChangeText={(t) => {
                        const v = Math.max(0, Number(t) || 0)
                        setEatenGrams((prev) => {
                          const next = [...prev]
                          next[idx] = v
                          return next
                        })
                      }}
                      keyboardType="number-pad"
                      style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary, width: 72 }]}
                    />
                    {item.packGrams != null && (
                      <Pressable
                        onPress={() =>
                          setEatenGrams((prev) => {
                            const next = [...prev]
                            next[idx] = item.packGrams!
                            return next
                          })
                        }
                      >
                        <Text style={{ color: MOD.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Whole</Text>
                      </Pressable>
                    )}
                    {item.packGrams != null && (
                      <Pressable
                        onPress={() =>
                          setEatenGrams((prev) => {
                            const next = [...prev]
                            next[idx] = Math.round(item.packGrams! / 2)
                            return next
                          })
                        }
                      >
                        <Text style={{ color: MOD.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Half</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )
            })}
            <Pressable onPress={() => void logAllScan()} disabled={aiBusy} style={[styles.submitBtn, { backgroundColor: '#7c3aed', marginTop: 8 }]}>
              <Text style={styles.submitText}>Log all at chosen grams</Text>
            </Pressable>
          </>
        )}
        {anthropicFileId && priorJson && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.macroInputLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Refine (same photo)</Text>
            <TextInput
              value={refineText}
              onChangeText={setRefineText}
              placeholder="e.g. I ate 200g of the 1kg yoghurt"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <Pressable
              onPress={() => void runRefine()}
              disabled={aiBusy || !refineText.trim()}
              style={[styles.secondaryBtn, { borderColor: MOD.primary, marginTop: 8, opacity: !refineText.trim() ? 0.5 : 1 }]}
            >
              <Text style={[styles.secondaryBtnText, { color: MOD.primary }]}>Apply correction</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Add food</Text>

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
                name={MEAL_ICONS[m] as React.ComponentProps<typeof Feather>['name']}
                size={14}
                color={selectedMeal === m ? '#fff' : colors.mutedForeground}
              />
              <Text style={[styles.mealChipText, { color: selectedMeal === m ? '#fff' : colors.mutedForeground }]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Brand or product (e.g. Delhaize yoghurt)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        />
        {productSearchError && name.trim().length >= 2 && (
          <Text style={[styles.warnBody, { color: '#f59e0b', marginBottom: 8 }]}>{productSearchError}</Text>
        )}
        {productHits.length > 0 && !catalogPick && (
          <View style={{ marginTop: 8, gap: 6 }}>
            {productHits.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  if (p.source === 'history' || p.assumedGrams == null) {
                    setName(p.name)
                    setKcal(p.kcal ? String(Math.round(p.kcal)) : '')
                    setProteinG(p.proteinG ? String(p.proteinG) : '')
                    setCarbsG(p.carbsG ? String(p.carbsG) : '')
                    setFatG(p.fatG ? String(p.fatG) : '')
                    setFiberG(p.fiberG ? String(p.fiberG) : '')
                    setProductHits([])
                  } else {
                    setCatalogPick(p)
                    setCatalogEatenG(p.packGrams && p.packGrams > 0 ? p.packGrams : p.assumedGrams || 100)
                    setName(p.name)
                    setProductHits([])
                  }
                }}
                style={[styles.scanRow, { borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryName, { color: colors.foreground }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
                    {p.source === 'history' ? 'Yours' : 'Open Food Facts'}
                    {p.source === 'openfoodfacts' ? ` · ${Math.round(p.kcal)} kcal/100g` : ` · ${Math.round(p.kcal)} kcal`}
                    {p.packGrams ? ` · pack ${p.packGrams}g` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {catalogPick && (
          <View style={[styles.scanRow, { borderColor: MOD.primary, flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 8 }]}>
            <Text style={[styles.entryName, { color: colors.foreground }]}>Adjust grams</Text>
            <Text style={[styles.entrySub, { color: colors.mutedForeground }]}>
              {Math.round(
                scalePortion(
                  {
                    kcal: catalogPick.kcal,
                    proteinG: catalogPick.proteinG,
                    carbsG: catalogPick.carbsG,
                    fatG: catalogPick.fatG,
                    fiberG: catalogPick.fiberG,
                    assumedGrams: catalogPick.assumedGrams,
                    packGrams: catalogPick.packGrams,
                  },
                  catalogEatenG,
                ).kcal,
              )}{' '}
              kcal for {Math.round(catalogEatenG)}g
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={String(Math.round(catalogEatenG))}
                onChangeText={(t) => setCatalogEatenG(Math.max(0, Number(t) || 0))}
                keyboardType="number-pad"
                style={[styles.macroInputField, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary, width: 72 }]}
              />
              {catalogPick.packGrams != null && (
                <Pressable onPress={() => setCatalogEatenG(catalogPick.packGrams!)}>
                  <Text style={{ color: MOD.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Whole</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setCatalogEatenG(100)}>
                <Text style={{ color: MOD.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>100g</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                const scaled = scalePortion(
                  {
                    kcal: catalogPick.kcal,
                    proteinG: catalogPick.proteinG,
                    carbsG: catalogPick.carbsG,
                    fatG: catalogPick.fatG,
                    fiberG: catalogPick.fiberG,
                    assumedGrams: catalogPick.assumedGrams,
                    packGrams: catalogPick.packGrams,
                  },
                  catalogEatenG,
                )
                setName(`${catalogPick.name} (${Math.round(catalogEatenG)}g)`)
                setKcal(String(Math.round(scaled.kcal)))
                setProteinG(String(scaled.proteinG))
                setCarbsG(String(scaled.carbsG))
                setFatG(String(scaled.fatG))
                setFiberG(String(scaled.fiberG))
                setNotes(
                  catalogPick.packGrams
                    ? `OFF pack ${catalogPick.packGrams}g · ate ${Math.round(catalogEatenG)}g`
                    : `OFF · ate ${Math.round(catalogEatenG)}g`,
                )
                setCatalogPick(null)
              }}
              style={[styles.submitBtn, { backgroundColor: MOD.primary }]}
            >
              <Text style={styles.submitText}>Use {Math.round(catalogEatenG)}g</Text>
            </Pressable>
          </View>
        )}

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
          disabled={mutation.isPending || !isPensApiConfigured()}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: MOD.primary, opacity: pressed || mutation.isPending || !isPensApiConfigured() ? 0.6 : 1 },
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Add food</Text>
          )}
        </Pressable>
      </View>

      {isPensApiConfigured() && isLoading ? (
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
                  <Pressable onPress={() => deleteMutation.mutate(e.id)} hitSlop={12}>
                    <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null,
        )
      )}

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
  warnCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 14 },
  warnTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 6 },
  warnBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  dateHint: { fontSize: 11, marginBottom: 4 },
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
  secondaryBtn: { height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  aiMeta: { fontSize: 11, marginTop: 8 },
  aiSummary: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  scanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  scanApply: { paddingHorizontal: 10, paddingVertical: 6 },
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
