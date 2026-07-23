/**
 * Calls the self-hosted MY PENS Next.js API from Expo (Bearer auth).
 *
 * Set in `.env`:
 *   EXPO_PUBLIC_PENS_API_URL=http://192.168.x.x:5000
 *   EXPO_PUBLIC_PENS_API_TOKEN=<same value as server MOBILE_PENS_API_TOKEN>
 */

const base = (process.env.EXPO_PUBLIC_PENS_API_URL ?? '').replace(/\/$/, '')
const token = (process.env.EXPO_PUBLIC_PENS_API_TOKEN ?? '').trim()

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
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('timed out')
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
    const healthRes = await fetch(`${base}/api/health`)
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
    const res = await pensFetch('/api/food/products?q=ab')
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

export async function pensFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!base) {
    throw new Error('EXPO_PUBLIC_PENS_API_URL is not set')
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  try {
    return await fetch(url, { ...init, headers })
  } catch (e: unknown) {
    throw new Error(describePensError(e))
  }
}
