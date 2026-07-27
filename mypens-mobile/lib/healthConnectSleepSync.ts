import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { ensureHcPairingFromApi, getHcPairingToken, isAndroidHealthConnectHost } from '@/lib/healthConnectSync'

const LAST_SLEEP_SYNC_KEY = '@mypens/hc_last_sleep_sync_iso'

export type HealthConnectSleepSession = {
  id: string
  startTime: string
  endTime: string
  /** Wake calendar date in device local TZ. */
  date: string
  bedtime: string
  wakeTime: string
  hours: number
  hrvMs?: number
  packageName?: string
  title?: string
  notes?: string
}

export async function getHcLastSleepSyncIso(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SLEEP_SYNC_KEY)
}

function pensBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localHhMm(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function localYmd(iso: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Dynamic import so Expo Go / web don't crash at module load. */
async function loadHc() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-health-connect') as typeof import('react-native-health-connect')
}

export type HcSleepSyncResult =
  | { ok: true; stored: number; skipped: number; read: number; updated?: number }
  | { ok: false; error: string }

const AUTO_SYNC_MIN_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Launch-time sleep sync with a 6h demper (WP 0.2).
 * Uses the same LAST_SLEEP_SYNC_KEY as manual Sync.
 */
export async function maybeAutoSyncHealthConnectSleep(): Promise<HcSleepSyncResult | null> {
  if (!isAndroidHealthConnectHost() || Platform.OS !== 'android') return null
  if (!pensBaseUrl()) return null

  const last = await getHcLastSleepSyncIso()
  if (last) {
    const age = Date.now() - Date.parse(last)
    if (Number.isFinite(age) && age >= 0 && age < AUTO_SYNC_MIN_MS) return null
  }

  return syncHealthConnectSleep()
}

/**
 * Average RMSSD (ms) from HeartRateVariabilityRmssd samples overlapping [start, end].
 * Returns undefined when none are available (quality stays null on server).
 */
async function averageHrvMs(
  hc: typeof import('react-native-health-connect'),
  startTime: string,
  endTime: string,
): Promise<number | undefined> {
  try {
    const { records } = await hc.readRecords('HeartRateVariabilityRmssd', {
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    })
    const values = (records ?? [])
      .map((r: { heartRateVariabilityMillis?: number }) => r.heartRateVariabilityMillis)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    if (values.length === 0) return undefined
    return values.reduce((a, b) => a + b, 0) / values.length
  } catch {
    // Permission may be denied or record type unavailable — sleep still syncs without HRV.
    return undefined
  }
}

/**
 * Read recent SleepSession records from Health Connect and POST them to
 * MY PENS `/api/integrations/healthconnect/sleep-ingest`.
 *
 * Sleep goes straight into SleepEntry (by wake date).
 * HC-sourced nights are updated; manual nights are skipped.
 */
export async function syncHealthConnectSleep(): Promise<HcSleepSyncResult> {
  if (!isAndroidHealthConnectHost() || Platform.OS !== 'android') {
    return { ok: false, error: 'Health Connect only works on Android.' }
  }

  const base = pensBaseUrl()
  if (!base) {
    return { ok: false, error: 'Set EXPO_PUBLIC_PENS_API_URL in mypens-mobile/.env' }
  }

  let token = await getHcPairingToken()
  if (!token) {
    const paired = await ensureHcPairingFromApi()
    if (!paired.ok) return { ok: false, error: paired.error }
    token = paired.token
  }

  let hc: typeof import('react-native-health-connect')
  try {
    hc = await loadHc()
  } catch {
    return {
      ok: false,
      error: 'Native Health Connect missing. Use a dev build (npx expo run:android), not Expo Go.',
    }
  }

  const status = await hc.getSdkStatus()
  if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      ok: false,
      error: 'Install / open the Health Connect app from the Play Store, then retry.',
    }
  }

  const ready = await hc.initialize()
  if (!ready) {
    return { ok: false, error: 'Health Connect failed to initialize.' }
  }

  const granted = await hc.requestPermission([
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  ])
  if (!granted?.length) {
    return { ok: false, error: 'Health Connect sleep permission denied.' }
  }

  const end = new Date()
  // Always re-read last 14 days; server updates HC rows / protects manual.
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000)

  const { records } = await hc.readRecords('SleepSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  })

  const sessions: HealthConnectSleepSession[] = []
  for (const r of records ?? []) {
    const row = r as {
      metadata?: { id?: string; dataOrigin?: string }
      startTime: string
      endTime: string
      title?: string | null
      notes?: string | null
    }
    if (!row.startTime || !row.endTime) continue
    const bedtime = localHhMm(row.startTime)
    const wakeTime = localHhMm(row.endTime)
    const date = localYmd(row.endTime)
    if (!bedtime || !wakeTime || !date) continue

    const startMs = Date.parse(row.startTime)
    const endMs = Date.parse(row.endTime)
    const hours =
      Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
        ? parseFloat(((endMs - startMs) / 3_600_000).toFixed(2))
        : 0
    if (hours <= 0 || hours > 24) continue

    const hrvMs = await averageHrvMs(hc, row.startTime, row.endTime)
    sessions.push({
      id: row.metadata?.id ?? `${row.startTime}-${row.endTime}`,
      startTime: row.startTime,
      endTime: row.endTime,
      date,
      bedtime,
      wakeTime,
      hours,
      hrvMs,
      packageName: row.metadata?.dataOrigin,
      title: row.title ?? undefined,
      notes: row.notes ?? undefined,
    })
  }

  const res = await fetch(`${base}/api/integrations/healthconnect/sleep-ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessions }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    stored?: number
    updated?: number
    skipped?: number
    error?: string
  }

  if (!res.ok || !body.ok) {
    return {
      ok: false,
      error: body.error ?? `Sleep ingest failed (${res.status}). Check pairing token + Base URL.`,
    }
  }

  await AsyncStorage.setItem(LAST_SLEEP_SYNC_KEY, end.toISOString())
  return {
    ok: true,
    stored: body.stored ?? 0,
    updated: body.updated ?? 0,
    skipped: body.skipped ?? 0,
    read: sessions.length,
  }
}
