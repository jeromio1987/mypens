/**
 * One-shot smoke: GET /api/body-phase (Prisma-backed).
 * Prints phase + kcal only — never the token.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const envPath = path.join(root, '.env')
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      let v = l.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return [l.slice(0, i).trim(), v]
    }),
)

const base = process.env.EXPO_PUBLIC_PENS_API_URL || 'http://127.0.0.1:5000'
const token = env.MOBILE_PENS_API_TOKEN
if (!token) {
  console.error('FAIL no MOBILE_PENS_API_TOKEN')
  process.exit(1)
}

const res = await fetch(`${base}/api/body-phase`, {
  headers: { Authorization: `Bearer ${token}` },
})
const text = await res.text()
let j = null
try {
  j = text ? JSON.parse(text) : null
} catch {
  console.error('FAIL bad json', res.status, text.slice(0, 200))
  process.exit(1)
}
if (!res.ok) {
  console.error('FAIL', res.status, j?.error || text.slice(0, 200))
  process.exit(1)
}
console.log(`OK phase=${j.phase} kcal=${j.targets?.kcal ?? '?'} startedAt=${j.startedAt}`)
