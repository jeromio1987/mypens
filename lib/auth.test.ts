import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionToken, verifySessionToken, verifyOwnerPassword } from '@/lib/auth'

describe('auth session tokens', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
  })

  afterEach(() => {
    delete process.env.SESSION_SECRET
  })

  it('creates a token that verifies', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()
    expect(await verifySessionToken(token!)).toBe(true)
  })

  it('rejects missing, malformed, and tampered tokens', async () => {
    expect(await verifySessionToken(undefined)).toBe(false)
    expect(await verifySessionToken('')).toBe(false)
    expect(await verifySessionToken('v1.notanumber.sig')).toBe(false)
    expect(await verifySessionToken('v0.1.abc')).toBe(false)

    const good = await createSessionToken()
    expect(good).toBeTruthy()
    const parts = good!.split('.')
    parts[2] = '00'.repeat(32)
    expect(await verifySessionToken(parts.join('.'))).toBe(false)
  })
})

describe('verifyOwnerPassword', () => {
  afterEach(() => {
    delete process.env.OWNER_PASSWORD
  })

  it('accepts exact password when configured', async () => {
    process.env.OWNER_PASSWORD = 'hunter2'
    expect(await verifyOwnerPassword('hunter2')).toBe(true)
    expect(await verifyOwnerPassword('wrong')).toBe(false)
  })

  it('rejects when not configured', async () => {
    expect(await verifyOwnerPassword('anything')).toBe(false)
  })
})
