/**
 * Pull Garmin wellness dailies (steps + active kcal) into garminDailyMetric.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function stripQuotes(v) {
  let out = String(v ?? '').trim()
  while (
    (out.startsWith('"') && out.endsWith('"') && out.length >= 2) ||
    (out.startsWith("'") && out.endsWith("'") && out.length >= 2)
  ) {
    out = out.slice(1, -1).trim()
  }
  return out
}

for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  process.env[m[1]] = stripQuotes(m[2])
}

const mod = await import(pathToFileURL(path.join(root, 'lib/integrations/garmin/dailiesSync.ts')).href)
const days = Number(process.argv[2] || 14)
const result = await mod.syncDailiesWellness(days)
console.log(JSON.stringify({ ok: true, days, result }, null, 2))
