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

export async function pensFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!base) {
    throw new Error('EXPO_PUBLIC_PENS_API_URL is not set')
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...init, headers })
}
