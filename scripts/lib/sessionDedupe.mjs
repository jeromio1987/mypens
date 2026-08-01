/**
 * Mirror of lib/sessionDedupe.ts for Node engine scripts (periodAnalyze / trainingLoad).
 * Keep algorithms in sync with the TypeScript module.
 */

const OVERLAP_RATIO = 0.5

export function sessionPreference(kind, source, packageName) {
  if (kind === 'garmin_activity') return 100
  if (kind === 'pushed') return 25
  const src = String(source ?? '').toLowerCase()
  const pkg = String(packageName ?? '').toLowerCase()
  if (src === 'garmin') return 80
  if (src === 'strava') return 70
  if (src === 'healthconnect' || src === 'healthkit') {
    if (pkg.includes('garmin')) return 60
    if (pkg.includes('fitness') || pkg.includes('google')) return 35
    return 45
  }
  if (src === 'manual') return 30
  return 40
}

export function syntheticWindowFromDate(date, durationSec, noonHour = 12) {
  const [y, m, d] = String(date).split('-').map(Number)
  const startMs = Date.UTC(y, m - 1, d, noonHour, 0, 0, 0)
  const dur = Math.max(0, Math.round(durationSec || 0)) * 1000
  return { startMs, endMs: startMs + Math.max(dur, 60_000) }
}

export function sessionsOverlap(a, b, ratio = OVERLAP_RATIO) {
  if (a.startMs == null || a.endMs == null || b.startMs == null || b.endMs == null) return false
  if (!(a.endMs > a.startMs) || !(b.endMs > b.startMs)) return false
  const overlapSec = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs)) / 1000
  const shorter = Math.min(
    a.durationSec > 0 ? a.durationSec : (a.endMs - a.startMs) / 1000,
    b.durationSec > 0 ? b.durationSec : (b.endMs - b.startMs) / 1000,
  )
  if (shorter <= 0) return false
  return overlapSec >= shorter * ratio
}

export function dedupeSessions(sessions) {
  if (!sessions?.length) return []
  if (sessions.length <= 1) return sessions.slice()
  const sorted = [...sessions].sort((a, b) => {
    if (b.preference !== a.preference) return b.preference - a.preference
    if (b.durationSec !== a.durationSec) return b.durationSec - a.durationSec
    const ak = a.kcal ?? 0
    const bk = b.kcal ?? 0
    if (bk !== ak) return bk - ak
    return String(a.id).localeCompare(String(b.id))
  })
  const kept = []
  for (const s of sorted) {
    if (!kept.some(k => sessionsOverlap(k, s))) kept.push(s)
  }
  kept.sort((a, b) => {
    const as = a.startMs ?? 0
    const bs = b.startMs ?? 0
    if (as !== bs) return as - bs
    return String(a.id).localeCompare(String(b.id))
  })
  return kept
}

export function parseTrainingWindow(externalRaw) {
  if (!externalRaw) {
    return { startMs: null, endMs: null, durationSec: 0, packageName: '' }
  }
  try {
    const o = JSON.parse(externalRaw)
    const start = Date.parse(o.startTime ?? o.start_date ?? '')
    let end = Date.parse(o.endTime ?? '')
    const durationSec =
      o.durationSec ??
      o.elapsed_time ??
      o.moving_time ??
      (Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.round((end - start) / 1000)
        : 0)
    if (Number.isFinite(start) && (!Number.isFinite(end) || end <= start) && durationSec > 0) {
      end = start + durationSec * 1000
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return {
        startMs: null,
        endMs: null,
        durationSec: durationSec || 0,
        packageName: o.packageName ?? '',
      }
    }
    return {
      startMs: start,
      endMs: end,
      durationSec: durationSec || Math.round((end - start) / 1000),
      packageName: o.packageName ?? '',
    }
  } catch {
    return { startMs: null, endMs: null, durationSec: 0, packageName: '' }
  }
}
