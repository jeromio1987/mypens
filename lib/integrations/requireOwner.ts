import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

function mobileBearerMatches(authHeader: string | null): boolean {
  const mobile = process.env.MOBILE_PENS_API_TOKEN?.trim()
  if (!mobile || !authHeader) return false
  return authHeader === `Bearer ${mobile}`
}

/**
 * Returns a 401 NextResponse if the caller is not an authenticated owner,
 * or null when authentication is valid. Call at the start of every
 * integration management route to enforce owner-only access.
 *
 * Also accepts `Authorization: Bearer <MOBILE_PENS_API_TOKEN>` so the Expo
 * app can read integration status using the same token as other mobile API calls.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  const h = await headers()
  if (mobileBearerMatches(h.get('authorization'))) {
    return null
  }

  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const ok = await verifySessionToken(token)
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
