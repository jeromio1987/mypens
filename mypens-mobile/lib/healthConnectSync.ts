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

/**
 * Issue (or refresh) the HC pairing token via the mobile API bearer —
 * no web /login or manual paste required after APK installs.
 * Uses POST /api/integrations/healthconnect/connect (owner = MOBILE_PENS_API_TOKEN).
 */
export async function ensureHcPairingFromApi(opts?: {
  force?: boolean
  deviceLabel?: string
}): Promise<{ ok: true; token: string; created: boolean } | { ok: false; error: string }> {
  const existing = await getHcPairingToken()
  if (existing && !opts?.force) {
    return { ok: true, token: existing, created: false }
  }

  try {
    const { pensFetch, isPensApiConfigured } = await import('@/lib/pensApi')
    if (!isPensApiConfigured()) {
      return {
        ok: false,
        error:
          'Set EXPO_PUBLIC_PENS_API_URL + EXPO_PUBLIC_PENS_API_TOKEN (same as Next MOBILE_PENS_API_TOKEN).',
      }
    }
    const res = await pensFetch('/api/integrations/healthconnect/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceLabel: opts?.deviceLabel ?? 'Android phone',
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      pairingToken?: string
      error?: string
    }
    if (!res.ok || !body.pairingToken) {
      return {
        ok: false,
        error: body.error ?? `Pairing failed (${res.status}). Is Next running?`,
      }
    }
    await setHcPairingToken(body.pairingToken)
    return { ok: true, token: body.pairingToken, created: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pairing failed' }
  }
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

/** Open system Health Connect settings (OxygenOS: often under Privacy, not the app drawer). */
export async function openHealthConnectSettings(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Platform.OS !== 'android') {
    return { ok: false, error: 'Health Connect is Android-only.' }
  }
  try {
    const hc = await loadHc()
    hc.openHealthConnectSettings()
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Could not open Health Connect. Try Settings → Security & privacy → Privacy → Health Connect.',
    }
  }
}

/** Read perms needed for EAT (sessions + Active Calories) and supporting fields. */
export const HC_WORKOUT_READ_PERMS = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'TotalCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'BasalMetabolicRate' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
]

const HC_EAT_CRITICAL = new Set(['ExerciseSession', 'ActiveCaloriesBurned'])

let hcPermPromptInFlight: Promise<HcPermResult> | null = null
let hcPermPromptedThisSession = false

export type HcPermResult =
  | { ok: true; grantedCritical: true; prompted: boolean }
  | { ok: true; grantedCritical: false; prompted: boolean }
  | { ok: false; error: string; prompted: boolean }

function hasCriticalHcReads(
  granted: Array<{ accessType?: string; recordType?: string }>,
): boolean {
  const reads = new Set(
    granted
      .filter(p => p.accessType === 'read' && typeof p.recordType === 'string')
      .map(p => p.recordType as string),
  )
  for (const need of HC_EAT_CRITICAL) {
    if (!reads.has(need)) return false
  }
  return true
}

/**
 * On launch / Training focus: if ExerciseSession or ActiveCaloriesBurned is missing,
 * show the system `requestPermission` dialog (cannot silent-grant). Idempotent per session
 * unless `force` — so we do not spam after a deny; Settings fallback remains available.
 */
export async function ensureHealthConnectPermissions(opts?: {
  force?: boolean
}): Promise<HcPermResult> {
  if (!isAndroidHealthConnectHost()) {
    return { ok: false, error: 'Health Connect is Android-only.', prompted: false }
  }
  if (hcPermPromptInFlight) return hcPermPromptInFlight

  hcPermPromptInFlight = (async (): Promise<HcPermResult> => {
    let hc: typeof import('react-native-health-connect')
    try {
      hc = await loadHc()
    } catch {
      return {
        ok: false,
        error: 'Native Health Connect missing. Use a debug build, not Expo Go.',
        prompted: false,
      }
    }

    const status = await hc.getSdkStatus()
    if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return {
        ok: false,
        error:
          'Health Connect not available. Settings → Security & privacy → Privacy → Health Connect.',
        prompted: false,
      }
    }

    const ready = await hc.initialize()
    if (!ready) {
      return { ok: false, error: 'Health Connect failed to initialize.', prompted: false }
    }

    let grantedList: Array<{ accessType?: string; recordType?: string }> = []
    try {
      grantedList = (await hc.getGrantedPermissions()) as Array<{
        accessType?: string
        recordType?: string
      }>
    } catch {
      grantedList = []
    }

    if (hasCriticalHcReads(grantedList)) {
      return { ok: true, grantedCritical: true, prompted: false }
    }

    // Missing critical reads — prompt once per process unless force (e.g. Sync now).
    if (hcPermPromptedThisSession && !opts?.force) {
      return { ok: true, grantedCritical: false, prompted: false }
    }

    hcPermPromptedThisSession = true
    const granted = await hc.requestPermission([...HC_WORKOUT_READ_PERMS])
    const after = (granted ?? []) as Array<{ accessType?: string; recordType?: string }>
    // Prefer the dialog result; fall back to a fresh read if the API returns empty.
    let finalList = after
    if (!hasCriticalHcReads(finalList)) {
      try {
        finalList = (await hc.getGrantedPermissions()) as Array<{
          accessType?: string
          recordType?: string
        }>
      } catch {
        /* keep after */
      }
    }
    return {
      ok: true,
      grantedCritical: hasCriticalHcReads(finalList),
      prompted: true,
    }
  })()

  try {
    return await hcPermPromptInFlight
  } finally {
    hcPermPromptInFlight = null
  }
}

export type HcSyncResult =
  | {
      ok: true
      stored: number
      skipped: number
      read: number
      imported?: number
      autoImport?: boolean
      skippedAlreadyKnown?: number
      needsLabel?: number
    }
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

function exerciseTypeName(
  hc: typeof import('react-native-health-connect'),
  raw: number | string | undefined,
): string {
  if (typeof raw === 'string' && raw.length > 0) {
    const bare = raw.match(/^(?:type[_\s-]*)?(\d+)$/i)
    if (bare) {
      const n = Number(bare[1])
      const entries = Object.entries(hc.ExerciseType) as [string, number][]
      const hit = entries.find(([, v]) => v === n)
      return hit?.[0] ?? `TYPE_${n}`
    }
    if (!raw.startsWith('TYPE_') && !/^\d+$/.test(raw)) return raw
  }
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.startsWith('TYPE_')
        ? Number(raw.slice(5))
        : NaN
  if (!Number.isFinite(n)) return 'OTHER_WORKOUT'
  const entries = Object.entries(hc.ExerciseType) as [string, number][]
  const hit = entries.find(([, v]) => v === n)
  return hit?.[0] ?? `TYPE_${n}`
}

/** Pull kcal from aggregate / record shapes (nested EnergyResult or flat / {value,unit}). */
function energyToKcal(raw: unknown): number | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw)
  if (typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const nested = [
    o.inKilocalories,
    o.ACTIVE_CALORIES_TOTAL,
    o.ENERGY_TOTAL,
    o.BASAL_CALORIES_TOTAL,
    o.energy,
  ]
  for (const c of nested) {
    if (c === raw) continue
    const n = energyToKcal(c)
    if (n != null) return n
  }
  if (typeof o.value === 'number' && Number.isFinite(o.value) && o.value > 0) {
    const unit = String(o.unit ?? 'kilocalories').toLowerCase()
    if (unit === 'calories') return Math.round(o.value / 1000)
    if (unit === 'kilojoules' || unit === 'joules') {
      const kj = unit === 'joules' ? o.value / 1000 : o.value
      return Math.round(kj / 4.184)
    }
    return Math.round(o.value)
  }
  return undefined
}

function aggregateKcal(result: unknown, keys: string[]): number | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  for (const k of keys) {
    const n = energyToKcal(r[k])
    if (n != null) return n
  }
  return energyToKcal(r.inKilocalories) ?? energyToKcal(r)
}

async function sumRecordEnergy(
  hc: typeof import('react-native-health-connect'),
  recordType: 'ActiveCaloriesBurned' | 'TotalCaloriesBurned',
  startTime: string,
  endTime: string,
): Promise<number | undefined> {
  try {
    const { records } = await hc.readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })
    let sum = 0
    for (const rec of records ?? []) {
      const n = energyToKcal((rec as { energy?: unknown }).energy)
      if (n != null) sum += n
    }
    return sum > 0 ? Math.round(sum) : undefined
  } catch {
    return undefined
  }
}

/**
 * Session active kcal for EAT.
 * Garmin→HC often omits ActiveCaloriesBurned and only writes TotalCaloriesBurned
 * for the workout window — fall back carefully (Total − Basal, then Total alone).
 */
async function sessionActiveKcal(
  hc: typeof import('react-native-health-connect'),
  startTime: string,
  endTime: string,
  sessionId?: string,
): Promise<number | undefined> {
  const tag = sessionId ? ` [${sessionId.slice(0, 8)}]` : ''
  const range = { operator: 'between' as const, startTime, endTime }

  try {
    const active = await hc.aggregateRecord({
      recordType: 'ActiveCaloriesBurned',
      timeRangeFilter: range,
    })
    const fromAgg = aggregateKcal(active, ['ACTIVE_CALORIES_TOTAL'])
    if (fromAgg != null) {
      console.log(`[HC]${tag} ActiveCalories aggregate=${fromAgg}`)
      return fromAgg
    }
  } catch (e) {
    console.warn(`[HC]${tag} ActiveCalories aggregate failed`, e)
  }

  const fromActiveRecords = await sumRecordEnergy(hc, 'ActiveCaloriesBurned', startTime, endTime)
  if (fromActiveRecords != null) {
    console.log(`[HC]${tag} ActiveCalories records sum=${fromActiveRecords}`)
    return fromActiveRecords
  }

  let total: number | undefined
  try {
    const tot = await hc.aggregateRecord({
      recordType: 'TotalCaloriesBurned',
      timeRangeFilter: range,
    })
    total = aggregateKcal(tot, ['ENERGY_TOTAL', 'TOTAL_CALORIES_BURNED'])
  } catch (e) {
    console.warn(`[HC]${tag} TotalCalories aggregate failed`, e)
  }
  if (total == null) {
    total = await sumRecordEnergy(hc, 'TotalCaloriesBurned', startTime, endTime)
  }

  if (total != null && total > 0) {
    let basal: number | undefined
    try {
      const b = await hc.aggregateRecord({
        recordType: 'BasalMetabolicRate',
        timeRangeFilter: range,
      })
      basal = aggregateKcal(b, ['BASAL_CALORIES_TOTAL'])
    } catch {
      /* optional */
    }
    if (basal != null && basal > 0 && total > basal) {
      const activeEst = Math.round(total - basal)
      console.log(`[HC]${tag} Total−Basal=${activeEst} (total=${total}, basal=${basal})`)
      return activeEst
    }
    // Session-window Total is still far better than EAT 0; stack BMR is separate.
    console.log(`[HC]${tag} TotalCalories fallback=${total}`)
    return total
  }

  console.warn(`[HC]${tag} no kcal for window ${startTime} → ${endTime}`)
  return undefined
}

async function sessionDistanceM(
  hc: typeof import('react-native-health-connect'),
  startTime: string,
  endTime: string,
): Promise<number | undefined> {
  try {
    const dist = await hc.aggregateRecord({
      recordType: 'Distance',
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })
    const m = dist?.DISTANCE?.inMeters
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) return Math.round(m)
  } catch {
    /* ignore */
  }
  return undefined
}

async function sessionAvgHr(
  hc: typeof import('react-native-health-connect'),
  startTime: string,
  endTime: string,
): Promise<number | undefined> {
  try {
    const hr = await hc.aggregateRecord({
      recordType: 'HeartRate',
      timeRangeFilter: { operator: 'between', startTime, endTime },
    })
    const bpm = hr?.BPM_AVG
    if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0) return Math.round(bpm)
  } catch {
    /* ignore */
  }
  return undefined
}

function packagePreferScore(packageName?: string): number {
  const p = (packageName ?? '').toLowerCase()
  if (p.includes('garmin')) return 3
  if (p.includes('strava')) return 2
  if (p.includes('fitness') || p.includes('google')) return 0
  return 1
}

function overlapSec(a: HealthConnectExerciseSession, b: HealthConnectExerciseSession): number {
  const a0 = Date.parse(a.startTime)
  const a1 = Date.parse(a.endTime ?? a.startTime)
  const b0 = Date.parse(b.startTime)
  const b1 = Date.parse(b.endTime ?? b.startTime)
  if (![a0, a1, b0, b1].every(Number.isFinite)) return 0
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / 1000
}

/** Drop Google Fit / short duplicates that sit inside a longer Garmin (etc.) session. */
function dedupeOverlappingSessions(
  sessions: HealthConnectExerciseSession[],
): HealthConnectExerciseSession[] {
  const sorted = [...sessions].sort((a, b) => {
    const score = packagePreferScore(b.packageName) - packagePreferScore(a.packageName)
    if (score !== 0) return score
    return (b.durationSec || 0) - (a.durationSec || 0)
  })
  const kept: HealthConnectExerciseSession[] = []
  for (const s of sorted) {
    const overlaps = kept.some(k => {
      const o = overlapSec(s, k)
      const shorter = Math.min(s.durationSec || 0, k.durationSec || 0)
      return shorter > 0 && o >= shorter * 0.5
    })
    if (!overlaps) kept.push(s)
  }
  return kept
}

function brusselsDateFromIso(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export type HealthConnectDayMetric = {
  date: string
  steps?: number
  activeKcal?: number
}

async function collectDayMetrics(
  hc: typeof import('react-native-health-connect'),
  start: Date,
  end: Date,
): Promise<HealthConnectDayMetric[]> {
  const out: HealthConnectDayMetric[] = []
  const cursor = new Date(start)
  cursor.setUTCHours(12, 0, 0, 0)
  const endMs = end.getTime()
  while (cursor.getTime() <= endMs) {
    const date = brusselsDateFromIso(cursor.toISOString())
    const noonUtcGuess = Date.parse(`${date}T12:00:00Z`)
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Brussels',
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(noonUtcGuess))
    const tzName = localParts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2'
    const m = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
    const offH = m ? Number(m[1]) : 2
    const offM = m && m[2] ? Number(m[2]) : 0
    const sign = offH >= 0 ? '+' : '-'
    const absH = Math.abs(offH)
    const offset = `${sign}${String(absH).padStart(2, '0')}:${String(offM).padStart(2, '0')}`
    const startIso = new Date(`${date}T00:00:00${offset}`).toISOString()
    const endIso = new Date(`${date}T23:59:59.999${offset}`).toISOString()

    let steps: number | undefined
    let activeKcal: number | undefined
    try {
      const s = await hc.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
      })
      const n = (s as { COUNT_TOTAL?: number })?.COUNT_TOTAL
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) steps = Math.round(n)
    } catch {
      /* ignore */
    }
    try {
      const a = await hc.aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
      })
      activeKcal = aggregateKcal(a, ['ACTIVE_CALORIES_TOTAL'])
    } catch {
      /* ignore */
    }
    // Day Active often missing from Garmin→HC; fall back to Total − Basal (same as session).
    if (activeKcal == null || activeKcal <= 0) {
      try {
        const tot = await hc.aggregateRecord({
          recordType: 'TotalCaloriesBurned',
          timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
        })
        const total = aggregateKcal(tot, ['ENERGY_TOTAL', 'TOTAL_CALORIES_BURNED'])
        if (total != null && total > 0) {
          let basal: number | undefined
          try {
            const b = await hc.aggregateRecord({
              recordType: 'BasalMetabolicRate',
              timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
            })
            basal = aggregateKcal(b, ['BASAL_CALORIES_TOTAL'])
          } catch {
            /* optional */
          }
          if (basal != null && basal > 0 && total > basal) {
            activeKcal = Math.round(total - basal)
            console.log(`[HC] day ${date} Active=Total−Basal=${activeKcal}`)
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (steps != null || (activeKcal != null && activeKcal > 0)) {
      out.push({ date, steps, activeKcal: activeKcal != null && activeKcal > 0 ? activeKcal : undefined })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/**
 * Read recent ExerciseSession records from Health Connect and POST them to
 * MY PENS `/api/integrations/healthconnect/ingest` with the pairing token.
 * Pulls ActiveCalories / Distance / HR for each session so EAT can update.
 */
export async function syncHealthConnectSessions(): Promise<HcSyncResult> {
  if (Platform.OS !== 'android') {
    return { ok: false, error: 'Health Connect only works on Android.' }
  }

  const base = pensBaseUrl()
  if (!base) {
    return { ok: false, error: 'Set EXPO_PUBLIC_PENS_API_URL in mypens-mobile/.env' }
  }

  let token = await getHcPairingToken()
  if (!token) {
    const paired = await ensureHcPairingFromApi()
    if (!paired.ok) {
      return { ok: false, error: paired.error }
    }
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
    try {
      hc.openHealthConnectSettings()
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error:
        'Health Connect not available. On OnePlus: Settings → Security & privacy → Privacy → Health Connect (or search “Health Connect”). Install/update from Play Store if missing, then retry.',
    }
  }

  const perm = await ensureHealthConnectPermissions({ force: true })
  if (!perm.ok) {
    return { ok: false, error: perm.error }
  }
  if (!perm.grantedCritical) {
    return {
      ok: false,
      error:
        'Health Connect needs Exercise Session + Active Calories. Allow the system dialog, or use Open Health Connect settings.',
    }
  }

  // ensureHealthConnectPermissions already initialized; re-bind for reads below.
  const ready = await hc.initialize()
  if (!ready) {
    return { ok: false, error: 'Health Connect failed to initialize.' }
  }

  const end = new Date()
  // Always re-read last 14 days; server dedupes by externalId and backfills kcal.
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000)

  const { records } = await hc.readRecords('ExerciseSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  })

  const sessionsRaw: HealthConnectExerciseSession[] = []
  for (const r of records ?? []) {
    const row = r as {
      metadata?: { id?: string; dataOrigin?: string }
      exerciseType?: number | string
      title?: string | null
      startTime: string
      endTime: string
      notes?: string | null
    }
    const startMs = Date.parse(row.startTime)
    const endMs = Date.parse(row.endTime)
    const durationSec =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(0, Math.round((endMs - startMs) / 1000))
        : 0

    const sessionId = row.metadata?.id ?? `${row.startTime}-${row.endTime}`
    const [totalEnergyKcal, totalDistanceM, averageHeartRate] = await Promise.all([
      sessionActiveKcal(hc, row.startTime, row.endTime, sessionId),
      sessionDistanceM(hc, row.startTime, row.endTime),
      sessionAvgHr(hc, row.startTime, row.endTime),
    ])

    sessionsRaw.push({
      id: sessionId,
      exerciseType: exerciseTypeName(hc, row.exerciseType),
      title: row.title ?? undefined,
      startTime: row.startTime,
      endTime: row.endTime,
      durationSec,
      totalDistanceM,
      totalEnergyKcal,
      averageHeartRate,
      packageName: row.metadata?.dataOrigin,
      notes: row.notes ?? undefined,
    })
  }

  const sessions = dedupeOverlappingSessions(sessionsRaw)
  if (sessions.length < sessionsRaw.length) {
    console.log(
      `[HC] deduped sessions ${sessionsRaw.length} → ${sessions.length} (prefer Garmin / longer)`,
    )
  }

  let dayMetrics: HealthConnectDayMetric[] = []
  try {
    dayMetrics = await collectDayMetrics(hc, start, end)
  } catch (e) {
    console.warn('[HC] day metrics failed', e)
  }

  const withKcal = sessions.filter(s => s.totalEnergyKcal != null && s.totalEnergyKcal > 0).length
  console.log(
    `[HC] posting ${sessions.length} sessions (${withKcal} with kcal), ${dayMetrics.length} day metrics`,
  )

  const res = await fetch(`${base}/api/integrations/healthconnect/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessions, dayMetrics }),
  })

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    stored?: number
    skipped?: number
    skippedAlreadyKnown?: number
    needsLabel?: number
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
    skippedAlreadyKnown: body.skippedAlreadyKnown ?? body.skipped ?? 0,
    needsLabel: body.needsLabel ?? 0,
    read: sessions.length,
    imported: body.imported ?? 0,
    autoImport: body.autoImport ?? false,
  }
}
