const SESSION_COOKIE_NAME = 'mp_session'
const SESSION_VERSION = 'v1'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const encoder = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0')
  }
  return s
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toHex(sig)
}

export async function createSessionToken(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = `${SESSION_VERSION}.${issuedAt}`
  const sig = await hmacHex(secret, payload)
  return `${payload}.${sig}`
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const secret = process.env.SESSION_SECRET
  if (!secret) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, issuedAtStr, sig] = parts
  if (version !== SESSION_VERSION) return false

  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false

  const now = Math.floor(Date.now() / 1000)
  if (now - issuedAt > SESSION_TTL_SECONDS) return false
  if (issuedAt > now + 60) return false

  const payload = `${version}.${issuedAtStr}`
  const expected = await hmacHex(secret, payload)
  return timingSafeEqual(sig, expected)
}

export async function verifyOwnerPassword(submitted: string): Promise<boolean> {
  const expected = process.env.OWNER_PASSWORD?.trim()
  if (!expected) return false
  if (typeof submitted !== 'string' || submitted.length === 0) return false
  // Compare trimmed submitted too — browsers/autofill sometimes add trailing spaces
  const submittedTrim = submitted.trim()
  if (!submittedTrim) return false

  const submittedHash = await hmacHex('mp-password-compare', submittedTrim)
  const expectedHash = await hmacHex('mp-password-compare', expected)
  return timingSafeEqual(submittedHash, expectedHash)
}

/** HMAC-signed token for time-limited read-only weight snapshot links (uses SESSION_SECRET). */
const READONLY_SNAPSHOT_VERSION = 'ro1'
const READONLY_SNAPSHOT_MAX_TTL_SEC = 60 * 60 * 24 * 90

export async function mintReadOnlySnapshotToken(ttlSeconds: number): Promise<string | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  const ttl = Math.min(
    READONLY_SNAPSHOT_MAX_TTL_SEC,
    Math.max(300, Math.floor(Number(ttlSeconds)) || 0),
  )
  const exp = Math.floor(Date.now() / 1000) + ttl
  const payload = `${READONLY_SNAPSHOT_VERSION}.${exp}`
  const sig = await hmacHex(secret, payload)
  return `${payload}.${sig}`
}

export async function verifyReadOnlySnapshotToken(
  token: string | undefined,
): Promise<{ ok: boolean; exp?: number }> {
  if (!token) return { ok: false }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }
  const [version, expStr, sig] = parts
  if (version !== READONLY_SNAPSHOT_VERSION) return { ok: false }

  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false }

  const now = Math.floor(Date.now() / 1000)
  if (exp < now) return { ok: false, exp }
  if (exp > now + READONLY_SNAPSHOT_MAX_TTL_SEC + 120) return { ok: false }

  const secret = process.env.SESSION_SECRET
  if (!secret) return { ok: false }

  const payload = `${version}.${expStr}`
  const expected = await hmacHex(secret, payload)
  if (!timingSafeEqual(sig, expected)) return { ok: false }
  return { ok: true, exp }
}

export const SESSION_COOKIE = SESSION_COOKIE_NAME
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS
