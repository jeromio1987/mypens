/**
 * Smoke energy-balance API for a date. Status + ledger fields only.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

const date = process.argv[2] || '2026-07-26'
const token = (process.env.MOBILE_PENS_API_TOKEN || '').trim()
const res = await fetch(`http://127.0.0.1:5000/api/energy-balance?date=${date}`, {
  headers: { Authorization: `Bearer ${token}` },
})
const j = await res.json()
console.log(
  JSON.stringify(
    {
      status: res.status,
      foodKcal: j.foodKcal,
      eat: j.eatKcal,
      neat: j.neatKcal,
      bmr: j.bmrKcal,
      delta: j.delta,
      estimatedOut: j.estimatedOut,
      neatSource: j.neatSource,
      neatDetail: j.neatDetail,
      deviceRef: j.deviceRef,
      sources: (j.sources || []).map((s) => ({
        origin: s.origin,
        label: s.label,
        kcal: s.kcal,
      })),
    },
    null,
    2,
  ),
)
