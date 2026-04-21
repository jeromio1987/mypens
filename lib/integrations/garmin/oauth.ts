import { prisma } from '@/lib/db'
import { createHash, randomBytes } from 'crypto'
import { getAppBaseUrl } from '../_shared/baseUrl'

const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm'
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'

export const GARMIN_SCOPES = 'ACTIVITY_READ'
export const GARMIN_STATE_COOKIE = 'garmin_oauth_state'
export const GARMIN_VERIFIER_COOKIE = 'garmin_oauth_verifier'

export { getAppBaseUrl }

export function getRedirectUri(req: Request): string {
  return `${getAppBaseUrl(req)}/api/integrations/garmin/callback`
}

export function generateState(): string {
  return randomBytes(24).toString('hex')
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function getAuthorizeUrl(req: Request, state: string, challenge: string): string {
  const clientId = process.env.GARMIN_CLIENT_ID
  if (!clientId) throw new Error('GARMIN_CLIENT_ID is not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(req),
    scope: GARMIN_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${GARMIN_AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number          // seconds until expiry
  refresh_token_expires_in?: number
  scope?: string
  token_type?: string
  jti?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin token request failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function exchangeCode(req: Request, code: string, verifier: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: process.env.GARMIN_CLIENT_ID!,
    client_secret: process.env.GARMIN_CLIENT_SECRET!,
    code,
    code_verifier: verifier,
    redirect_uri: getRedirectUri(req),
  })
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: 'refresh_token',
    client_id: process.env.GARMIN_CLIENT_ID!,
    client_secret: process.env.GARMIN_CLIENT_SECRET!,
    refresh_token: refreshToken,
  })
}

export async function getValidAccessToken(): Promise<{ accessToken: string; garminUserId: string }> {
  const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
  if (!conn) throw new Error('NOT_CONNECTED')

  const now = Math.floor(Date.now() / 1000)
  if (conn.expiresAt - 60 > now) {
    return { accessToken: conn.accessToken, garminUserId: conn.garminUserId }
  }

  const fresh = await refreshTokens(conn.refreshToken)
  const expiresAt = Math.floor(Date.now() / 1000) + fresh.expires_in
  await prisma.garminConnection.update({
    where: { userId: 'default' },
    data: {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt,
    },
  })
  return { accessToken: fresh.access_token, garminUserId: conn.garminUserId }
}

export async function persistConnection(token: TokenResponse, garminUserId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + token.expires_in
  await prisma.garminConnection.upsert({
    where: { userId: 'default' },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
      garminUserId,
    },
    create: {
      userId: 'default',
      garminUserId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
    },
  })
}

/** Resolve Garmin's UserID for the current access token. */
export async function fetchUserId(accessToken: string): Promise<string> {
  const res = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ''
  const data = (await res.json()) as { userId?: string }
  return data.userId ?? ''
}
