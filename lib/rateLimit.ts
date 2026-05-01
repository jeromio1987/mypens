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
