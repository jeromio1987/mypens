import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true })
  // Raw Set-Cookie so clear flags match login (Next cookies.set can force Secure).
  const secure = shouldUseSecureCookie(request)
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
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
    return false
  }
  const hostHeader = (request.headers.get('host') || '').split(':')[0]?.toLowerCase() || ''
  const xfHost = (request.headers.get('x-forwarded-host') || '').split(':')[0]?.toLowerCase() || ''
  const hosts = [hostname, hostHeader, xfHost].filter(Boolean)
  if (hosts.some(isLocalOrPrivateHost)) return false
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
