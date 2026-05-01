import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

/**
 * Returns a 401 NextResponse if the caller is not an authenticated owner,
 * or null when authentication is valid. Call at the start of every
 * integration management route to enforce owner-only access.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const ok = await verifySessionToken(token)
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
