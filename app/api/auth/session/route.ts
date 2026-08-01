import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

/**
 * Lightweight session probe for the login form (and debugging).
 * Public route — returns whether the current cookie is a valid owner session.
 * Does not leak token material.
 */
export async function GET() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const ok = await verifySessionToken(token)
  return NextResponse.json(
    { authenticated: ok },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
