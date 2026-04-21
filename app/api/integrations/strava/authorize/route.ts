import { NextResponse } from 'next/server'
import { generateState, getAuthorizeUrl, STRAVA_STATE_COOKIE } from '@/lib/integrations/strava/oauth'

export async function GET(request: Request) {
  try {
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Strava is not configured (missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)' },
        { status: 500 },
      )
    }
    const state = generateState()
    const res = NextResponse.redirect(getAuthorizeUrl(request, state))
    res.cookies.set(STRAVA_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 600, // 10 minutes
    })
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to start Strava authorization' }, { status: 500 })
  }
}
