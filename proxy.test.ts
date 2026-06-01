import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { proxy } from '@/proxy'

describe('proxy middleware', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
    delete process.env.MOBILE_PENS_API_TOKEN
  })

  afterEach(() => {
    delete process.env.SESSION_SECRET
    delete process.env.MOBILE_PENS_API_TOKEN
  })

  it('allows /api/health without credentials', async () => {
    const req = new NextRequest(new URL('http://localhost/api/health'))
    const res = await proxy(req)
    expect(res.status).toBeLessThan(400)
  })

  it('returns 401 for protected API without session or bearer', async () => {
    const req = new NextRequest(new URL('http://localhost/api/weight'))
    const res = await proxy(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('allows protected API with valid session cookie', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()
    const req = new NextRequest(new URL('http://localhost/api/weight'), {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    })
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('allows protected API with mobile bearer when token is set', async () => {
    process.env.MOBILE_PENS_API_TOKEN = 'mobile-test-token'
    const req = new NextRequest(new URL('http://localhost/api/weight'), {
      headers: { authorization: 'Bearer mobile-test-token' },
    })
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('redirects unauthenticated HTML routes to /login', async () => {
    const req = new NextRequest(new URL('http://localhost/dashboard'))
    const res = await proxy(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const loc = res.headers.get('location')
    expect(loc).toContain('/login')
    expect(loc).toContain('next=')
  })

  it('allows /login without session', async () => {
    const req = new NextRequest(new URL('http://localhost/login'))
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })
})
