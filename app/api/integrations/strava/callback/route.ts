import { NextResponse } from 'next/server'
import { exchangeCode, getAppBaseUrl, persistConnection, STRAVA_STATE_COOKIE } from '@/lib/integrations/strava/oauth'
import { ensureSubscription } from '@/lib/integrations/strava/webhook'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

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

  // Verify the owner session. The OAuth redirect returns to the same browser
  // that started the flow, so the session cookie must still be valid.
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  const authenticated = await verifySessionToken(sessionToken)
  if (!authenticated) {
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/login?next=/integrations`),
    )
  }

  // CSRF protection: verify state matches the cookie set in /authorize
  const expectedState = cookieStore.get(STRAVA_STATE_COOKIE)?.value
  if (!expectedState || !stateParam || expectedState !== stateParam) {
    return clearStateCookie(
      NextResponse.redirect(`${redirectBase}/integrations?strava_error=invalid_state`),
    )
  }

  try {
    const token = await exchangeCode(code)
    await persistConnection(token)

    // Best-effort: subscribe the app's webhook so future activity events
    // auto-import. We do NOT fail the connect if this throws — the user can
    // still use the manual "Sync now" + daily cron fallback.
    try {
      const callbackUrl = `${redirectBase}/api/integrations/strava/webhook`
      // ensureSubscription persists the verify token to the connection row
      // BEFORE calling Strava, so the handshake GET succeeds.
      const sub = await ensureSubscription(callbackUrl)
      await prisma.stravaConnection.update({
        where: { userId: 'default' },
        data: {
          webhookId: sub.subscriptionId,
          lastError: null,
          lastErrorAt: null,
        },
      })
    } catch (subErr) {
      console.error('[strava] webhook subscribe failed', subErr)
      const msg = subErr instanceof Error ? subErr.message : 'webhook subscribe failed'
      await prisma.stravaConnection.updateMany({
        where: { userId: 'default' },
        data: { lastError: msg, lastErrorAt: new Date() },
      })
    }

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
