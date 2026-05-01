import { NextResponse } from 'next/server'
import {
  GARMIN_STATE_COOKIE,
  GARMIN_VERIFIER_COOKIE,
  generatePkce,
  generateState,
  getAuthorizeUrl,
} from '@/lib/integrations/garmin/oauth'
import { requireOwner } from '@/lib/integrations/requireOwner'

export async function GET(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    if (!process.env.GARMIN_CLIENT_ID || !process.env.GARMIN_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Garmin is not configured (missing GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET)' },
        { status: 500 },
      )
    }
    const state = generateState()
    const { verifier, challenge } = generatePkce()
    const res = NextResponse.redirect(getAuthorizeUrl(request, state, challenge))
    const opts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/', maxAge: 600 }
    res.cookies.set(GARMIN_STATE_COOKIE, state, opts)
    res.cookies.set(GARMIN_VERIFIER_COOKIE, verifier, opts)
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to start Garmin authorization' }, { status: 500 })
  }
}
