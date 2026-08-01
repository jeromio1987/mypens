import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, isAuthDisabled, verifySessionToken } from '@/lib/auth'
import { isPublicApiRoute } from '@/lib/publicApiRoutes'

const PUBLIC_PAGES = new Set<string>([
  '/login',
  '/welcome',
  '/design',
  // Static design specimen — renders no user data.
  '/design/continental',
  '/snapshot',
])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Local bypass: MYPENS_AUTH_DISABLED=true skips cookie/password entirely (single-user dev).
  if (isAuthDisabled()) {
    return NextResponse.next()
  }

  if (pathname === '/welcome') {
    const res = NextResponse.next()
    if (req.cookies.get('mp_seen_welcome')?.value !== '1') {
      res.cookies.set('mp_seen_welcome', '1', {
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
    return res
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next()
    }
    const mobile = process.env.MOBILE_PENS_API_TOKEN?.trim()
    if (mobile) {
      const auth = req.headers.get('authorization')
      if (auth === `Bearer ${mobile}`) {
        return NextResponse.next()
      }
    }
    const token = req.cookies.get(SESSION_COOKIE)?.value
    const ok = await verifySessionToken(token)
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (PUBLIC_PAGES.has(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const ok = await verifySessionToken(token)
  if (!ok) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|manifest.webmanifest|sw.js|workbox-|icon-|apple-touch-icon|illustrations/|images/|fonts/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|map)$).*)',
  ],
}
