import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
  verifyOwnerPassword,
  mintReadOnlySnapshotToken,
  verifyReadOnlySnapshotToken,
} from '@/lib/auth'

describe('auth session tokens', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
    delete process.env.MYPENS_AUTH_DISABLED
  })

  afterEach(() => {
    delete process.env.SESSION_SECRET
    delete process.env.MYPENS_AUTH_DISABLED
  })

  it('accepts any caller when MYPENS_AUTH_DISABLED is set', async () => {
    process.env.MYPENS_AUTH_DISABLED = 'true'
    expect(await verifySessionToken(undefined)).toBe(true)
    expect(await verifySessionToken('')).toBe(true)
  })

  it('creates a token that verifies', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()
    expect(token!.startsWith('v1.')).toBe(true)
    expect(await verifySessionToken(token!)).toBe(true)
  })

  it('rejects missing, malformed, and tampered tokens', async () => {
    expect(await verifySessionToken(undefined)).toBe(false)
    expect(await verifySessionToken('')).toBe(false)
    expect(await verifySessionToken('v1.notanumber.sig')).toBe(false)
    expect(await verifySessionToken('v0.1.abc')).toBe(false)
    expect(await verifySessionToken('v2.1.0.abc')).toBe(false)

    const good = await createSessionToken()
    expect(good).toBeTruthy()
    const parts = good!.split('.')
    parts[2] = '00'.repeat(32)
    expect(await verifySessionToken(parts.join('.'))).toBe(false)
  })

  it('share-link tokens still verify independently', async () => {
    const share = await mintReadOnlySnapshotToken(3600)
    expect(share).toBeTruthy()
    expect((await verifyReadOnlySnapshotToken(share!)).ok).toBe(true)
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
