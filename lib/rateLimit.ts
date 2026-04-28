// Tiny in-memory token bucket. Single-process, no external deps.
// Sized for a single-user local app — not a substitute for real auth.
const buckets = new Map<string, { tokens: number; lastRefill: number }>()

interface RateLimitOptions {
  capacity?: number   // max tokens (= burst size)
  refillPerSec?: number
}

export function consume(
  key: string,
  { capacity = 10, refillPerSec = 0.2 }: RateLimitOptions = {},
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: capacity, lastRefill: now }
  const elapsedSec = (now - b.lastRefill) / 1000
  const refill = elapsedSec * refillPerSec
  b.tokens = Math.min(capacity, b.tokens + refill)
  b.lastRefill = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return { ok: false, remaining: 0 }
  }
  b.tokens -= 1
  buckets.set(key, b)
  return { ok: true, remaining: Math.floor(b.tokens) }
}

/**
 * Allow same-origin POSTs only.
 *
 * Browsers always send `Origin` for cross-origin POST + multipart uploads, so
 * for the photo upload (the only caller right now) we can REQUIRE Origin and
 * reject anything cross-site. This is stricter than the previous version,
 * which let no-Origin requests through — that hole is now closed.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false  // no Origin → not a trusted browser POST
  const host = req.headers.get('host')
  if (!host) return false
  try {
    const u = new URL(origin)
    return u.host === host
  } catch {
    return false
  }
}
