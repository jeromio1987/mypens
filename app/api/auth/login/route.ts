import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifyOwnerPassword,
} from '@/lib/auth'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const password = (body && typeof body === 'object' && 'password' in body)
    ? (body as { password: unknown }).password
    : undefined

  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  if (!process.env.SESSION_SECRET || !process.env.OWNER_PASSWORD) {
    return NextResponse.json(
      { error: 'Server is not configured for authentication' },
      { status: 503 },
    )
  }

  const ok = await verifyOwnerPassword(password)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await createSessionToken()
  if (!token) {
    return NextResponse.json(
      { error: 'Server is not configured for authentication' },
      { status: 503 },
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
