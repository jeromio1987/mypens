#!/usr/bin/env node
/**
 * myPENS truth / contradiction gate (WP 0.8).
 * Exit 0 = PASS. Exit 1 = FAIL.
 *
 * Phase-0 checks:
 *   T1 — narrowed: arithmetic on API-shaped fields in components (allowlist) — warn
 *   T2 — score without coverage field — fail
 *   T3 — missing empty-state signal on list/aggregate screens — fail
 *   T8 — date-identity anti-patterns outside timeWindow — fail on critical lanes, warn elsewhere
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..', '..')

const failures = []
const warnings = []

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === 'dist') continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) acc.push(p)
  }
  return acc
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

/** Canonical owners of calendar-day identity (P9). */
const T8_ALLOW = new Set([
  'lib/timeWindow.ts',
  'scripts/lib/timeWindow.mjs',
  'mypens-mobile/lib/timeWindow.ts',
  'lib/weekDates.ts',
  'scripts/lib/weekDates.mjs',
  'lib/energyWeek.ts',
  'mypens-mobile/lib/cockpitWindow.ts',
  'tests/timeWindow.test.ts',
  'tests/weekEnergyThyroid.test.ts',
])

/** Lanes that define "today" / "this week" for health numbers — must be clean. */
const T8_CRITICAL_PREFIXES = [
  'app/api/verdict/',
  'app/api/dashboard/',
  'app/api/period-review/',
  'app/api/energy-balance/',
  'app/api/mode/',
  'app/api/sleep/',
  'app/api/morning-brief/',
  'app/api/streaks/',
  'mypens-mobile/lib/cockpitWindow.ts',
  'mypens-mobile/app/(tabs)/training.tsx',
  'mypens-mobile/app/(tabs)/food.tsx',
  'mypens-mobile/app/verdict.tsx',
]

const T8_PATTERNS = [
  { name: 'toISOString().slice(0,10)', re: /\.toISOString\(\)\s*\.\s*slice\s*\(\s*0\s*,\s*10\s*\)/ },
  { name: 'toISOString().split("T")[0]', re: /\.toISOString\(\)\s*\.\s*split\s*\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/ },
  { name: 'local dateNDaysAgo / nDaysAgo helper', re: /function\s+(dateNDaysAgo|nDaysAgo)\s*\(/ },
]

function isCritical(r) {
  return T8_CRITICAL_PREFIXES.some((p) => r === p || r.startsWith(p))
}

function checkT8() {
  const files = [
    ...walk(path.join(ROOT, 'app')),
    ...walk(path.join(ROOT, 'lib')),
    ...walk(path.join(ROOT, 'components')),
    ...walk(path.join(ROOT, 'scripts')),
    ...walk(path.join(ROOT, 'mypens-mobile', 'app')),
    ...walk(path.join(ROOT, 'mypens-mobile', 'lib')),
    ...walk(path.join(ROOT, 'mypens-mobile', 'components')),
    ...walk(path.join(ROOT, 'mypens-mobile', 'hooks')),
  ]
  for (const file of files) {
    const r = rel(file)
    if (T8_ALLOW.has(r)) continue
    if (r.includes('__tests__') || r.endsWith('.test.ts') || r.endsWith('.test.tsx')) continue
    if (r.startsWith('scripts/_')) continue
    const src = fs.readFileSync(file, 'utf8')
    for (const pat of T8_PATTERNS) {
      if (!pat.re.test(src)) continue
      const msg = `T8 ${pat.name} in ${r} — use lib/timeWindow (P9)`
      if (isCritical(r)) failures.push(msg)
      else warnings.push(msg)
    }
  }
}

const T1_ALLOWLIST = new Set([
  // Charts / cockpit — display scaling of API fields is intentional UI, not a second engine.
  'components/period-review/PeriodCockpit.tsx',
  'components/food/EnergyWeekChart.tsx',
  'components/food/EnergyBalanceCard.tsx', // bar stack heights from API kcal fields
  'components/goals/GoalsPanel.tsx', // progress % display from API goal numbers
  'components/home/HomeReadCard.tsx', // read copy formatting from API payload
  'mypens-mobile/components/TrainingReviewCard.tsx',
  'mypens-mobile/components/EngineReadCard.tsx',
  'mypens-mobile/components/OrphanActivitiesBanner.tsx', // count / age display from API orphans
  'mypens-mobile/app/(tabs)/food.tsx', // chart + macro bar fill from API day totals
  'mypens-mobile/app/period-review.tsx', // cockpit display math
  'mypens-mobile/app/weekly-feedback.tsx', // week score presentation
])

const T1_ENGINE_SMELL =
  /\b(data|res|json|payload|response)\.[a-zA-Z_][\w.]*\s*[\/*+-]|\.reduce\s*\([^)]*=>[^)]*\+|\/\s*7\b|\*\s*100\b/

function checkT1() {
  const dirs = [
    path.join(ROOT, 'components'),
    path.join(ROOT, 'mypens-mobile', 'app'),
    path.join(ROOT, 'mypens-mobile', 'components'),
  ]
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const r = rel(file)
      if (T1_ALLOWLIST.has(r)) continue
      const src = fs.readFileSync(file, 'utf8')
      if (!/\b(fetch|pensFetch|useQuery|api\/)/.test(src)) continue
      if (T1_ENGINE_SMELL.test(src)) {
        warnings.push(
          `T1 possible engine math in ${r} — move to API/engine or add to T1 allowlist with reason`,
        )
      }
    }
  }
}

function checkT2() {
  // Grep the implementation owner, not thin route wrappers (WP 2.2 → lib/verdictData.ts).
  const verdict = path.join(ROOT, 'lib', 'verdictData.ts')
  if (!fs.existsSync(verdict)) {
    failures.push('T2 missing lib/verdictData.ts')
    return
  }
  const src = fs.readFileSync(verdict, 'utf8')
  if (!/hasDataP/.test(src) || !/PILLAR_COVERAGE_MIN/.test(src)) {
    failures.push('T2 verdict must gate scores on per-pillar coverage (PILLAR_COVERAGE_MIN)')
  }
  if (!/scoreP = hasDataP \?/.test(src)) {
    failures.push('T2 uncovered pillars must not emit a numeric score')
  }
}

function checkT3() {
  const suspects = [
    'mypens-mobile/app/(tabs)/food.tsx',
    'mypens-mobile/app/(tabs)/training.tsx',
    'mypens-mobile/app/(tabs)/sleep.tsx',
    'mypens-mobile/app/verdict.tsx',
    // Client owns empty-state UI; page.tsx is a thin SSR wrapper after WP 2.2.
    'app/verdict/VerdictClient.tsx',
    'app/dashboard/DashboardClient.tsx',
  ]
  const emptyMarkers = /EmptyHint|empty|no data|onvoldoende|incompleteCapture|hasEnoughData|Building your baseline|—/i
  for (const r of suspects) {
    const file = path.join(ROOT, ...r.split('/'))
    if (!fs.existsSync(file)) {
      warnings.push(`T3 skip missing ${r}`)
      continue
    }
    const src = fs.readFileSync(file, 'utf8')
    if (!emptyMarkers.test(src)) {
      failures.push(`T3 ${r} has no detectable empty-state branch`)
    }
  }
}

checkT8()
checkT1()
checkT2()
checkT3()

console.log('=== myPENS truth-check ===')
if (failures.length === 0) {
  console.log('PASS')
} else {
  console.log('FAIL')
  for (const f of failures) console.log('  ✗', f)
}
if (warnings.length) {
  console.log(`Warnings (non-blocking, ${warnings.length}):`)
  for (const w of warnings.slice(0, 40)) console.log('  ·', w)
  if (warnings.length > 40) console.log(`  · … +${warnings.length - 40} more`)
}

process.exit(failures.length ? 1 : 0)
