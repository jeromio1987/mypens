import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const TOKEN_KEY = '@mypens/hc_pairing_token'
const LAST_SYNC_KEY = '@mypens/hc_last_sync_iso'
const AUTO_SYNC_KEY = '@mypens/hc_auto_sync'

/** Minimum gap between automatic syncs (manual Sync now is always allowed). */
export const HC_AUTO_SYNC_MIN_INTERVAL_MS = 20 * 60 * 1000

export type HealthConnectExerciseSession = {
  id: string
  exerciseType: string
  title?: string
  startTime: string
  endTime?: string
  durationSec: number
  totalDistanceM?: number
  totalEnergyKcal?: number
  averageHeartRate?: number
  packageName?: string
  notes?: string
}

export async function getHcPairingToken(): Promise<string> {
  return ((await AsyncStorage.getItem(TOKEN_KEY)) ?? '').trim()
}

export async function setHcPairingToken(token: string): Promise<void> {
  const t = token.trim()
  if (!t) await AsyncStorage.removeItem(TOKEN_KEY)
  else await AsyncStorage.setItem(TOKEN_KEY, t)
}

export async function getHcLastSyncIso(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY)
}

/** Default ON on Android; persisted once the user toggles. */
export async function getHcAutoSyncEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(AUTO_SYNC_KEY)
  if (v === null) return Platform.OS === 'android'
  return v === '1'
}

export async function setHcAutoSyncEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_SYNC_KEY, on ? '1' : '0')
}

function pensBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '')
}

/** Dynamic import so Expo Go / web don't crash at module load. */
async function loadHc() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-health-connect') as typeof import('react-native-health-connect')
}

export function isAndroidHealthConnectHost(): boolean {
  return Platform.OS === 'android'
}

export type HcSyncResult =
  | { ok: true; stored: number; skipped: number; read: number; imported?: number; autoImport?: boolean }
  | { ok: false; error: string }

/**
 * If auto-sync is enabled, a pairing token exists, and the last sync is older
 * than ~20 min (or never), run a Health Connect pull. Returns null when skipped.
 */
export async function maybeAutoSyncHealthConnect(): Promise<HcSyncResult | null> {
  if (!isAndroidHealthConnectHost()) return null
  if (!(await getHcAutoSyncEnabled())) return null
  if (!(await getHcPairingToken())) return null

  const last = await getHcLastSyncIso()
  if (last) {
    const age = Date.now() - Date.parse(last)
    if (Number.isFinite(age) && age < HC_AUTO_SYNC_MIN_INTERVAL_MS) return null
  }

  return syncHealthConnectSessions()
}

/**
 * Read recent ExerciseSession records from Health Connect and POST them to
 * MY PENS `/api/integrations/healthconnect/ingest` with the pairing token.
 */
export async function syncHealthConnectSessions(): Promise<HcSyncResult> {
  if (Platform.OS !== 'android') {
    return { ok: false, error: 'Health Connect only works on Android.' }
  }

  const base = pensBaseUrl()
  if (!base) {
    return { ok: false, error: 'Set EXPO_PUBLIC_PENS_API_URL in mypens-mobile/.env' }
  }

  const token = await getHcPairingToken()
  if (!token) {
    return { ok: false, error: 'Paste the pairing token from /integrations first.' }
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
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'TotalCaloriesBurned' },
    { accessType: 'read', recordType: 'HeartRate' },
  ])
  if (!granted?.length) {
    return { ok: false, error: 'Health Connect permission denied.' }
  }

  const end = new Date()
  // Always re-read last 14 days; server dedupes by externalId.
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000)

  const { records } = await hc.readRecords('ExerciseSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  })

  const sessions: HealthConnectExerciseSession[] = (records ?? []).map((r: {
    metadata?: { id?: string; dataOrigin?: string }
    exerciseType?: number | string
    title?: string | null
    startTime: string
    endTime: string
    notes?: string | null
  }) => {
    const startMs = Date.parse(r.startTime)
    const endMs = Date.parse(r.endTime)
    const durationSec = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(0, Math.round((endMs - startMs) / 1000))
      : 0
    const exerciseType =
      typeof r.exerciseType === 'string'
        ? r.exerciseType
        : typeof r.exerciseType === 'number'
          ? `TYPE_${r.exerciseType}`
          : 'OTHER_WORKOUT'

    return {
      id: r.metadata?.id ?? `${r.startTime}-${r.endTime}`,
      exerciseType,
      title: r.title ?? undefined,
      startTime: r.startTime,
      endTime: r.endTime,
      durationSec,
      packageName: r.metadata?.dataOrigin,
      notes: r.notes ?? undefined,
    }
  })

  const res = await fetch(`${base}/api/integrations/healthconnect/ingest`, {
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
    skipped?: number
    imported?: number
    autoImport?: boolean
    error?: string
  }

  if (!res.ok || !body.ok) {
    return {
      ok: false,
      error: body.error ?? `Ingest failed (${res.status}). Check pairing token + Base URL.`,
    }
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, end.toISOString())
  return {
    ok: true,
    stored: body.stored ?? 0,
    skipped: body.skipped ?? 0,
    read: sessions.length,
    imported: body.imported ?? 0,
    autoImport: body.autoImport ?? false,
  }
}
