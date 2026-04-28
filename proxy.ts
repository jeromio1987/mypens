import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Set the "seen welcome" cookie the moment the user lands on /welcome,
// so the first-time-visitor redirect at `/` doesn't loop.
export function proxy(req: NextRequest) {
  const res = NextResponse.next()
  if (req.nextUrl.pathname === '/welcome') {
    if (req.cookies.get('mp_seen_welcome')?.value !== '1') {
      res.cookies.set('mp_seen_welcome', '1', {
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
  }
  return res
}

export const config = {
  matcher: ['/welcome'],
}
