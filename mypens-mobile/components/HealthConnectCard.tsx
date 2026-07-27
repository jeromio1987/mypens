import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import {
  ensureHcPairingFromApi,
  getHcAutoSyncEnabled,
  getHcLastSyncIso,
  getHcPairingToken,
  isAndroidHealthConnectHost,
  maybeAutoSyncHealthConnect,
  openHealthConnectSettings,
  setHcAutoSyncEnabled,
  setHcPairingToken,
  syncHealthConnectSessions,
  type HcSyncResult,
} from '@/lib/healthConnectSync'
import { syncHealthConnectSleep, type HcSleepSyncResult } from '@/lib/healthConnectSleepSync'

const MOD = MODULE_COLORS.training

function formatWorkoutStatus(result: Extract<HcSyncResult, { ok: true }>): string {
  if (result.read === 0) {
    return 'Workouts: no sessions in HC (last 14 days)'
  }
  const known = result.skippedAlreadyKnown ?? result.skipped
  const needs = result.needsLabel ?? 0
  const parts: string[] = []
  if (result.autoImport) {
    parts.push(`${result.imported ?? result.stored} imported`)
  } else {
    parts.push(`${result.stored} new`)
  }
  if (known > 0) parts.push(`${known} already known`)
  if (needs > 0) parts.push(`${needs} need a label`)
  return `Workouts: ${parts.join(', ')}`
}

function formatSleepStatus(result: HcSleepSyncResult): string {
  if (!result.ok) return `Sleep: ${result.error}`
  if (result.read === 0) return 'Sleep: no SleepSession in HC'
  return `Sleep: ${result.stored} new, ${result.skipped} already logged`
}

function combineStatus(workouts: HcSyncResult, sleep: HcSleepSyncResult): string {
  const parts: string[] = []
  if (workouts.ok) parts.push(formatWorkoutStatus(workouts))
  else parts.push(`Workouts: ${workouts.error}`)
  parts.push(formatSleepStatus(sleep))
  const anyOk = workouts.ok || sleep.ok
  return anyOk ? `Synced — ${parts.join('. ')}.` : parts.join(' · ')
}

/** Collapsed by default: status + Sync now. Token / re-pair under Advanced. */
export function HealthConnectCard() {
  const colors = useColors()
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const autoRunning = useRef(false)

  const reload = useCallback(async () => {
    const paired = await ensureHcPairingFromApi()
    if (paired.ok) {
      setToken(paired.token)
      setSaved(true)
      if (paired.created) setStatus('Paired via API')
    } else {
      setToken(await getHcPairingToken())
      setSaved(Boolean(await getHcPairingToken()))
      if (paired.error) setStatus(paired.error)
    }
    setLastSync(await getHcLastSyncIso())
    setAutoSync(await getHcAutoSyncEnabled())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const runAutoIfDue = useCallback(async () => {
    if (autoRunning.current || busy) return
    autoRunning.current = true
    try {
      const workouts = await maybeAutoSyncHealthConnect()
      if (!workouts) return
      const sleep = await syncHealthConnectSleep()
      setStatus(`Auto-sync: ${combineStatus(workouts, sleep)}`)
      if (workouts.ok) setLastSync(await getHcLastSyncIso())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Auto-sync failed')
    } finally {
      autoRunning.current = false
    }
  }, [busy])

  useFocusEffect(
    useCallback(() => {
      void runAutoIfDue()
    }, [runAutoIfDue]),
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void runAutoIfDue()
    })
    return () => sub.remove()
  }, [runAutoIfDue])

  if (!isAndroidHealthConnectHost()) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: MOD.primary }]}>Health Connect</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Android only. On iPhone use Apple Health instead.
        </Text>
      </View>
    )
  }

  const saveToken = async () => {
    await setHcPairingToken(token)
    setSaved(Boolean(token.trim()))
    setStatus(token.trim() ? 'Token saved on this phone.' : 'Token cleared.')
  }

  const toggleAutoSync = async (on: boolean) => {
    setAutoSync(on)
    await setHcAutoSyncEnabled(on)
    setStatus(on ? 'Auto-sync on' : 'Auto-sync off')
  }

  const runSync = async () => {
    setBusy(true)
    setStatus(null)
    try {
      if (token.trim() && token.trim() !== (await getHcPairingToken())) {
        await setHcPairingToken(token)
        setSaved(true)
      }
      const workouts = await syncHealthConnectSessions()
      const sleep = await syncHealthConnectSleep()
      setStatus(combineStatus(workouts, sleep))
      if (workouts.ok) setLastSync(await getHcLastSyncIso())
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  const pairedLabel = saved ? 'Paired' : 'Not paired'
  const syncLabel = lastSync
    ? `Last sync ${new Date(lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced yet'

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="heart-pulse" size={18} color={MOD.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MOD.primary }]}>Health Connect</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {pairedLabel} · {syncLabel}
          </Text>
        </View>
        <View style={styles.autoMini}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>Auto</Text>
          <Switch
            value={autoSync}
            onValueChange={(v) => void toggleAutoSync(v)}
            trackColor={{ false: colors.border, true: MOD.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Pressable
        onPress={() => void runSync()}
        disabled={busy}
        style={[styles.btnPrimary, { backgroundColor: MOD.primary, opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Sync now</Text>
          </>
        )}
      </Pressable>

      {status ? (
        <Text
          style={[
            styles.meta,
            {
              color:
                status.includes('Synced') || status.includes('Auto-sync: Synced') || status.includes('Paired')
                  ? colors.success
                  : colors.warning,
            },
          ]}
        >
          {status}
        </Text>
      ) : null}

      <Pressable onPress={() => setShowAdvanced((s) => !s)} style={styles.expandBtn} hitSlop={8}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </Text>
        <Feather name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
      </Pressable>

      {showAdvanced ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Pairing is automatic via the API token. Use advanced only if auto-pair fails.
            {'\n'}OnePlus: Settings → Security & privacy → Privacy → Health Connect.
          </Text>
          <Pressable
            onPress={() => {
              void (async () => {
                setBusy(true)
                const r = await ensureHcPairingFromApi({ force: true })
                setBusy(false)
                if (r.ok) {
                  setToken(r.token)
                  setSaved(true)
                  setStatus('Re-paired via API.')
                } else setStatus(r.error)
              })()
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>Re-pair via API</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void (async () => {
                const r = await openHealthConnectSettings()
                if (!r.ok) setStatus(r.error)
              })()
            }}
            style={[styles.btn, { borderColor: colors.border }]}
          >
            <Text style={[styles.btnText, { color: colors.foreground }]}>Open Health Connect settings</Text>
          </Pressable>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="Optional override token"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.secondary,
              },
            ]}
          />
          <Pressable onPress={() => void saveToken()} style={[styles.btn, { borderColor: colors.border }]}>
            <Text style={[styles.btnText, { color: colors.foreground }]}>
              {saved ? 'Update token' : 'Save token'}
            </Text>
          </Pressable>
          {Platform.OS === 'android' ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              Base URL: {(process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '') || '(not set)'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoMini: { alignItems: 'center', gap: 2 },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  body: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  btnPrimary: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 2 },
})
