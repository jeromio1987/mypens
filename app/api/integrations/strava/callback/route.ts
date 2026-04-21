import { NextResponse } from 'next/server'
import { exchangeCode, getAppBaseUrl, persistConnection, STRAVA_STATE_COOKIE } from '@/lib/integrations/strava/oauth'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const stateParam = url.searchParams.get('state')

  const redirectBase = getAppBaseUrl(request)

  // Always clear the state cookie after a callback attempt
  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set(STRAVA_STATE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 0,
    })
    return res
  }

  if (error) {
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_error=${encodeURIComponent(error)}`),
    )
  }
  if (!code) {
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_error=missing_code`),
    )
  }

  // CSRF protection: verify state matches the cookie set in /authorize
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STRAVA_STATE_COOKIE)?.value
  if (!expectedState || !stateParam || expectedState !== stateParam) {
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_error=invalid_state`),
    )
  }

  try {
    const token = await exchangeCode(code)
    await persistConnection(token)
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_connected=1`),
    )
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : 'callback_failed'
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_error=${encodeURIComponent(msg)}`),
    )
  }
}
