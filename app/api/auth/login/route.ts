import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyOwnerPassword,
} from '@/lib/auth'
import { consume } from '@/lib/rateLimit'

export async function POST(request: Request) {
  // Same in-memory bucket pattern as photo routes — throttle the single
  // password that guards the whole app (burst 10, ~10/hour refill).
  const rl = consume('auth-login:global', { capacity: 10, refillPerSec: 10 / 3600 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const password = (body && typeof body === 'object' && 'password' in body)
    ? (body as { password: unknown }).password
    : undefined

  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  if (!process.env.SESSION_SECRET?.trim() || !process.env.OWNER_PASSWORD?.trim()) {
    return NextResponse.json(
      { error: 'Server is not configured for authentication' },
      { status: 503 },
    )
  }

  const ok = await verifyOwnerPassword(password)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await createSessionToken()
  if (!token) {
    return NextResponse.json(
      { error: 'Server is not configured for authentication' },
      { status: 503 },
    )
  }

  // Secure cookies only on real HTTPS. Loopback / private LAN over HTTP must stay
  // non-secure or the browser silently drops the session (login looks like a no-op).
  // Use a raw Set-Cookie header: NextResponse.cookies.set() can force Secure when
  // x-forwarded-proto is https even on http://127.0.0.1.
  const secure = shouldUseSecureCookie(request)
  const res = NextResponse.json({ ok: true })
  const maxAge = SESSION_MAX_AGE
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString()
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    `Expires=${expires}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  res.headers.append('Set-Cookie', parts.join('; '))
  return res
}

function shouldUseSecureCookie(request: Request): boolean {
  let hostname = ''
  let urlHttps = false
  try {
    const u = new URL(request.url)
    hostname = u.hostname.toLowerCase()
    urlHttps = u.protocol === 'https:'
  } catch {
    /* ignore */
  }
  const hostHeader = (request.headers.get('host') || '').split(':')[0]?.toLowerCase() || ''
  const xfHost = (request.headers.get('x-forwarded-host') || '').split(':')[0]?.toLowerCase() || ''
  const hosts = [hostname, hostHeader, xfHost].filter(Boolean)
  if (hosts.some(isLocalOrPrivateHost)) {
    return false
  }
  const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0]?.trim().toLowerCase()
  return proto === 'https' || urlHttps
}

function isLocalOrPrivateHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  ) {
    return true
  }
  return isPrivateOrLinkLocalIpv4(hostname)
}

function isPrivateOrLinkLocalIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}
