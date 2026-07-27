import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import {
  ensureHcPairingFromApi,
  getHcPairingToken,
  isAndroidHealthConnectHost,
} from '@/lib/healthConnectSync'
import {
  getHcLastSleepSyncIso,
  syncHealthConnectSleep,
} from '@/lib/healthConnectSleepSync'
import { isPensApiConfigured, pensFetch } from '@/lib/pensApi'

const MOD = MODULE_COLORS.sleep

type Props = {
  /** Called after a successful sync so the Sleep list can refetch. */
  onSynced?: () => void
}

type DiagPayload = {
  pairing?: {
    lastSyncAt?: string | null
    lastError?: string | null
    lastErrorAt?: string | null
  }
  sleep?: {
    nightsLogged?: number
    healthConnectNights?: number
    firstDate?: string | null
    lastDate?: string | null
  }
}

/**
 * Compact sleep sync — pairing lives on Training; this is Sync sleep only.
 * WP 0.1: status shows read / stored / skipped / first–last date + server error.
 */
export function HealthConnectSleepCard({ onSynced }: Props) {
  const colors = useColors()
  const [saved, setSaved] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    await ensureHcPairingFromApi()
    setSaved(Boolean(await getHcPairingToken()))
    setLastSync(await getHcLastSleepSyncIso())
    if (isPensApiConfigured()) {
      try {
        const res = await pensFetch('/api/integrations/healthconnect/sleep-diagnostics')
        if (res.ok) {
          const j = (await res.json()) as DiagPayload
          if (j.pairing?.lastError) {
            setServerError(
              `${j.pairing.lastError}${j.pairing.lastErrorAt ? ` · ${j.pairing.lastErrorAt.slice(0, 16)}` : ''}`,
            )
          } else {
            setServerError(null)
          }
        }
      } catch {
        /* diagnostics optional */
      }
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (!isAndroidHealthConnectHost()) {
    return null
  }

  const runSync = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await syncHealthConnectSleep()
      if (result.ok) {
        const read = result.read ?? 0
        const stored = result.stored ?? 0
        const skipped = result.skipped ?? 0
        if (result.read === 0) {
          setStatus('read 0 · No sleep sessions in HC (last 14 days)')
        } else {
          const updated = result.updated ?? 0
          let range = ''
          if (isPensApiConfigured()) {
            try {
              const res = await pensFetch('/api/integrations/healthconnect/sleep-diagnostics')
              if (res.ok) {
                const j = (await res.json()) as DiagPayload
                if (j.sleep?.firstDate && j.sleep?.lastDate) {
                  range = ` · ${j.sleep.firstDate} → ${j.sleep.lastDate}`
                }
                if (j.pairing?.lastError) {
                  setServerError(j.pairing.lastError)
                }
              }
            } catch {
              /* ignore */
            }
          }
          setStatus(
            `read ${read} · stored ${stored} · updated ${updated} · skipped ${skipped}${range}`,
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

  const syncLabel = lastSync
    ? `Last sync ${new Date(lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : saved
      ? 'Ready to sync'
      : 'Not paired — open Training'

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="sleep" size={18} color={MOD.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: MOD.primary }]}>Health Connect</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{syncLabel}</Text>
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
              <Text style={styles.btnPrimaryText}>Sync</Text>
            </>
          )}
        </Pressable>
      </View>
      {status ? (
        <Text
          style={[
            styles.meta,
            {
              color:
                status.includes('stored') || status.includes('new')
                  ? colors.success
                  : colors.warning,
            },
          ]}
        >
          {status}
        </Text>
      ) : null}
      {serverError ? (
        <Text style={[styles.meta, { color: colors.warning }]}>Server: {serverError}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
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
  btnPrimary: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
})
