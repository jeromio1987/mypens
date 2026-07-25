import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import {
  getHcPairingToken,
  isAndroidHealthConnectHost,
  setHcPairingToken,
} from '@/lib/healthConnectSync'
import {
  getHcLastSleepSyncIso,
  syncHealthConnectSleep,
} from '@/lib/healthConnectSleepSync'

const MOD = MODULE_COLORS.sleep

type Props = {
  /** Called after a successful sync so the Sleep list can refetch. */
  onSynced?: () => void
}

/**
 * Sleep-specific Health Connect card.
 * Sleep lands in SleepEntry immediately — not the workout review queue.
 */
export function HealthConnectSleepCard({ onSynced }: Props) {
  const colors = useColors()
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setToken(await getHcPairingToken())
    setLastSync(await getHcLastSleepSyncIso())
    setSaved(Boolean(await getHcPairingToken()))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!isAndroidHealthConnectHost()) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: MOD.primary }]}>Health Connect · Sleep</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Android only. Pair once on the Training tab (or below), then Sync sleep here.
        </Text>
      </View>
    )
  }

  const saveToken = async () => {
    await setHcPairingToken(token)
    setSaved(Boolean(token.trim()))
    setStatus(token.trim() ? 'Token saved on this phone.' : 'Token cleared.')
  }

  const runSync = async () => {
    setBusy(true)
    setStatus(null)
    try {
      if (token.trim() && token.trim() !== (await getHcPairingToken())) {
        await setHcPairingToken(token)
        setSaved(true)
      }
      const result = await syncHealthConnectSleep()
      if (result.ok) {
        if (result.read === 0) {
          setStatus(
            'OK — no SleepSession rows in Health Connect (last 14 days). Confirm Garmin writes sleep to HC.',
          )
        } else {
          setStatus(
            `Sleep synced — ${result.stored} new night(s), ${result.skipped} already logged (${result.read} read). Check Recent below.`,
          )
        }
        setLastSync(await getHcLastSleepSyncIso())
        onSynced?.()
      } else {
        setStatus(result.error)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Sleep sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="sleep" size={18} color={MOD.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MOD.primary }]}>Health Connect · Sleep</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Garmin → Health Connect → Sleep log
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Sleep is not the workout queue.{'\n'}
        1. Same pairing token as Training (paste once if needed){'\n'}
        2. Allow SleepSession in Health Connect{'\n'}
        3. Sync now — nights go straight into Recent below{'\n'}
        Quality defaults to 3★ unless HRV is available; edit stars anytime.
      </Text>

      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="Pairing token from /integrations"
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

      <View style={styles.row}>
        <Pressable
          onPress={() => void saveToken()}
          style={[styles.btn, { borderColor: colors.border }]}
        >
          <Text style={[styles.btnText, { color: colors.foreground }]}>
            {saved ? 'Update token' : 'Save token'}
          </Text>
        </Pressable>
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
              <Text style={styles.btnPrimaryText}>Sync sleep</Text>
            </>
          )}
        </Pressable>
      </View>

      {lastSync && (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          Last sleep sync: {new Date(lastSync).toLocaleString()}
        </Text>
      )}
      {status && (
        <Text
          style={[
            styles.meta,
            {
              color:
                status.startsWith('Sleep synced') || status.startsWith('OK')
                  ? colors.success
                  : colors.warning,
            },
          ]}
        >
          {status}
        </Text>
      )}
      {Platform.OS === 'android' && (
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          Base URL: {(process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '') || '(not set)'}
        </Text>
      )}
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
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  btnPrimary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
})
