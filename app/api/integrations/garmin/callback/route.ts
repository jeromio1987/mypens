import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  GARMIN_STATE_COOKIE,
  GARMIN_VERIFIER_COOKIE,
  exchangeCode,
  fetchUserId,
  getAppBaseUrl,
  persistConnection,
} from '@/lib/integrations/garmin/oauth'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const stateParam = url.searchParams.get('state')

  const redirectBase = getAppBaseUrl(request)
  const clearCookies = (res: NextResponse) => {
    const opts = { httpOnly: true, sameSite: 'lax' as const, secure: true, path: '/', maxAge: 0 }
    res.cookies.set(GARMIN_STATE_COOKIE, '', opts)
    res.cookies.set(GARMIN_VERIFIER_COOKIE, '', opts)
    return res
  }

  if (error) {
    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_error=${encodeURIComponent(error)}`),
    )
  }
  if (!code) {
    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_error=missing_code`),
    )
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(GARMIN_STATE_COOKIE)?.value
  const verifier = cookieStore.get(GARMIN_VERIFIER_COOKIE)?.value
  if (!expectedState || !stateParam || expectedState !== stateParam) {
    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_error=invalid_state`),
    )
  }
  if (!verifier) {
    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_error=missing_verifier`),
    )
  }

  try {
    const token = await exchangeCode(request, code, verifier)
    const garminUserId = await fetchUserId(token.access_token).catch(() => '')
    await persistConnection(token, garminUserId)

    // Best-effort: kick off the initial backfill so prior activities arrive
    // via the configured Push (Activity Ping Service) endpoint. Errors are
    // captured on the connection row but never block the connect flow — the
    // user can still rely on the daily cron + manual "Sync now".
    const { ensurePushSubscription } = await import('@/lib/integrations/garmin/webhook')
    await ensurePushSubscription()

    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_connected=1`),
    )
  } catch (err) {
    console.error(err)
    const msg = err instanceof Error ? err.message : 'callback_failed'
    return clearCookies(
      NextResponse.redirect(`${redirectBase}/integrations?garmin_error=${encodeURIComponent(msg)}`),
    )
  }
}
