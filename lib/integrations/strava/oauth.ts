import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

export const STRAVA_SCOPES = 'read,activity:read'
export const STRAVA_STATE_COOKIE = 'strava_oauth_state'

/**
 * Resolve a trusted base URL for the app. Prefers NEXT_PUBLIC_APP_URL when set
 * (configured by the user / Replit), falling back to REPLIT_DEV_DOMAIN, and
 * finally to the request host as a last resort.
 */
export function getAppBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  const dev = process.env.REPLIT_DEV_DOMAIN
  if (dev) return `https://${dev}`
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? url.host
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

export function getRedirectUri(req: Request): string {
  return `${getAppBaseUrl(req)}/api/integrations/strava/callback`
}

export function generateState(): string {
  return randomBytes(24).toString('hex')
}

export function getAuthorizeUrl(req: Request, state?: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) throw new Error('STRAVA_CLIENT_ID is not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(req),
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    ...(state ? { state } : {}),
  })
  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  scope?: string
  athlete?: { id: number }
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`)
  }
  return res.json()
}

/** Returns a valid access token, refreshing if necessary. Throws if not connected. */
export async function getValidAccessToken(): Promise<{ accessToken: string; athleteId: string }> {
  const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
  if (!conn) throw new Error('NOT_CONNECTED')

  const now = Math.floor(Date.now() / 1000)
  if (conn.expiresAt - 60 > now) {
    return { accessToken: conn.accessToken, athleteId: conn.athleteId }
  }

  const fresh = await refreshTokens(conn.refreshToken)
  await prisma.stravaConnection.update({
    where: { userId: 'default' },
    data: {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: fresh.expires_at,
    },
  })
  return { accessToken: fresh.access_token, athleteId: conn.athleteId }
}

export async function persistConnection(token: TokenResponse): Promise<void> {
  const athleteId = token.athlete?.id ? String(token.athlete.id) : ''
  await prisma.stravaConnection.upsert({
    where: { userId: 'default' },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scope: token.scope,
      ...(athleteId ? { athleteId } : {}),
    },
    create: {
      userId: 'default',
      athleteId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scope: token.scope,
    },
  })
}
