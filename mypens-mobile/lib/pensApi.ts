/**
 * Calls the self-hosted MY PENS Next.js API from Expo (Bearer auth).
 *
 * Set in `.env` (daily phone → Vercel; LAN :5000 only for agents):
 *   EXPO_PUBLIC_PENS_API_URL=https://mypens.vercel.app
 *   EXPO_PUBLIC_PENS_API_TOKEN=<same value as Vercel MOBILE_PENS_API_TOKEN>
 */

const base = (process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '')
const token = (process.env.EXPO_PUBLIC_PENS_API_TOKEN ?? '').trim()

/** Default request budget — hung Next must not leave Fueling/Read spinners forever. */
export const PENS_FETCH_TIMEOUT_MS = 12_000
export const PENS_PHOTO_TIMEOUT_MS = 90_000

export function isPensApiConfigured(): boolean {
  return Boolean(base && token)
}

export function pensApiBaseUrl(): string {
  return base
}

export type PensApiProbe =
  | { status: 'unconfigured' }
  | { status: 'unreachable'; detail: string }
  | { status: 'server_token_missing'; baseUrl: string }
  | { status: 'unauthorized'; baseUrl: string }
  | { status: 'ok'; baseUrl: string; hasAnthropicKey: boolean }

/** Human-readable fetch failures (RN often only says "Network request failed"). */
export function describePensError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (
    lower.includes('abort') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    const where = base || '(EXPO_PUBLIC_PENS_API_URL not set)'
    return (
      `MY PENS at ${where} did not respond in time (server may be wedged). ` +
      `Open ${where}/api/health on the phone browser; if it hangs, restart Next (\`npm run dev\` on the PC).`
    )
  }
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error')
  ) {
    const where = base || '(EXPO_PUBLIC_PENS_API_URL not set)'
    return (
      `Cannot reach MY PENS at ${where}. ` +
      `On the phone browser open ${where}/api/health — if that fails, fix LAN IP / Wi‑Fi / Windows Firewall for port 5000. ` +
      `Also confirm Next is running (npm run dev) and Expo was restarted after .env changes.`
    )
  }
  if (lower.includes('unauthorized') || msg.includes('401')) {
    return (
      'API unauthorized. Set MOBILE_PENS_API_TOKEN in the Next app .env to the same value as ' +
      'EXPO_PUBLIC_PENS_API_TOKEN in mypens-mobile/.env, then restart Next (npm run dev).'
    )
  }
  return msg
}

function mergeAbortSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a && !b) return undefined
  if (a && !b) return a
  if (b && !a) return b
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  a!.addEventListener('abort', onAbort)
  b!.addEventListener('abort', onAbort)
  if (a!.aborted || b!.aborted) ctrl.abort()
  return ctrl.signal
}

/**
 * Lightweight connectivity / auth probe for Food and other tabs.
 * Uses public /api/health, then a tiny authenticated food products call.
 */
export async function probePensApi(): Promise<PensApiProbe> {
  if (!base || !token) return { status: 'unconfigured' }

  let healthJson: {
    ok?: boolean
    env?: { hasAnthropicKey?: boolean; hasMobileToken?: boolean }
  }
  try {
    const healthRes = await pensFetch('/api/health', { timeoutMs: 5000 }, { skipAuth: true })
    if (!healthRes.ok) {
      return { status: 'unreachable', detail: `Health returned ${healthRes.status}` }
    }
    healthJson = (await healthRes.json()) as typeof healthJson
  } catch (e: unknown) {
    return { status: 'unreachable', detail: describePensError(e) }
  }

  if (!healthJson?.env?.hasMobileToken) {
    return { status: 'server_token_missing', baseUrl: base }
  }

  try {
    const res = await pensFetch('/api/food/products?q=ab', { timeoutMs: 8000 })
    if (res.status === 401) {
      return { status: 'unauthorized', baseUrl: base }
    }
    if (!res.ok) {
      return { status: 'unreachable', detail: `Auth probe ${res.status}` }
    }
  } catch (e: unknown) {
    return { status: 'unreachable', detail: describePensError(e) }
  }

  return {
    status: 'ok',
    baseUrl: base,
    hasAnthropicKey: Boolean(healthJson.env?.hasAnthropicKey),
  }
}

type PensFetchInit = RequestInit & {
  /** Override default timeout (ms). Photo analyze should pass a longer budget. */
  timeoutMs?: number
}

/**
 * Authenticated fetch with hard timeout so a wedged Next cannot pin UI spinners.
 */
export async function pensFetch(
  path: string,
  init?: PensFetchInit,
  opts?: { skipAuth?: boolean },
): Promise<Response> {
  if (!base) {
    throw new Error('EXPO_PUBLIC_PENS_API_URL is not set')
  }
  const { timeoutMs = PENS_FETCH_TIMEOUT_MS, signal: userSignal, ...rest } = init ?? {}
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(rest.headers)
  if (!opts?.skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  // RN multipart: never force Content-Type — fetch must set boundary itself.
  if (typeof FormData !== 'undefined' && rest.body instanceof FormData) {
    headers.delete('Content-Type')
  }
  const timer = new AbortController()
  const timerId = setTimeout(() => timer.abort(), timeoutMs)
  const signal = mergeAbortSignals(userSignal ?? null, timer.signal)
  try {
    return await fetch(url, { ...rest, headers, signal })
  } catch (e: unknown) {
    // Preserve user Cancel so callers can silence the alert (do not rewrite as timeout).
    if (userSignal?.aborted) {
      const abortErr = new Error('Aborted')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    throw new Error(describePensError(e))
  } finally {
    clearTimeout(timerId)
  }
}
