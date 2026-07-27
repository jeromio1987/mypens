/**
 * Strip accidental outer quotes from DATABASE_URL in local env files.
 * Prints only shape diagnostics — never the secret.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = ['.env', '.env.local', '.env.development', '.env.development.local']

function stripOuterQuotes(v) {
  let out = v.trim()
  let changed = false
  while (
    (out.startsWith('"') && out.endsWith('"') && out.length >= 2) ||
    (out.startsWith("'") && out.endsWith("'") && out.length >= 2)
  ) {
    out = out.slice(1, -1).trim()
    changed = true
  }
  // Broken leftover quote chars
  if (/^["']/.test(out) || /["']$/.test(out)) {
    out = out.replace(/^["']+/, '').replace(/["']+$/, '')
    changed = true
  }
  return { value: out, changed }
}

for (const rel of files) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ file: rel, skipped: true }))
    continue
  }
  const raw = fs.readFileSync(file, 'utf8')
  const nl = raw.includes('\r\n') ? '\r\n' : '\n'
  const lines = raw.split(/\r?\n/)
  let info = null
  const fixed = lines.map((line) => {
    const m = line.match(/^(DATABASE_URL)\s*=\s*(.*)$/)
    if (!m) return line
    const before = m[2]
    const { value, changed } = stripOuterQuotes(before)
    info = {
      file: rel,
      changed,
      ok: /^postgres(ql)?:\/\//i.test(value),
      len: value.length,
      prefix: value.slice(0, 15),
      rawStartedWithQuote: /^\s*["']/.test(before),
    }
    return `DATABASE_URL=${value}`
  })
  if (info?.changed) {
    fs.writeFileSync(file, fixed.join(nl), 'utf8')
  }
  console.log(JSON.stringify(info || { file: rel, skipped: 'no DATABASE_URL' }))
}
