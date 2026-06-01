import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    stravaConnection: {
      findUnique: mocks.findUnique,
    },
  },
}))

vi.mock('@/lib/integrations/strava/sync', () => ({
  deleteImportedActivity: vi.fn(),
  syncSingleActivity: vi.fn(),
}))

import { GET, POST } from '@/app/api/integrations/strava/webhook/route'

describe('Strava webhook route', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
  })

  it('GET handshake echoes challenge when verify_token matches', async () => {
    mocks.findUnique.mockResolvedValue({
      webhookVerifyToken: 'my-verify',
      webhookId: 42,
      athleteId: '99',
    })
    const url =
      'http://localhost/api/integrations/strava/webhook?hub.mode=subscribe&hub.verify_token=my-verify&hub.challenge=abc123'
    const res = await GET(new Request(url))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ 'hub.challenge': 'abc123' })
  })

  it('GET handshake rejects wrong verify_token', async () => {
    mocks.findUnique.mockResolvedValue({
      webhookVerifyToken: 'expected',
      webhookId: 1,
      athleteId: '1',
    })
    const url =
      'http://localhost/api/integrations/strava/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x'
    const res = await GET(new Request(url))
    expect(res.status).toBe(403)
  })

  it('POST rejects unknown subscription id', async () => {
    mocks.findUnique.mockResolvedValue({
      webhookId: 111,
      athleteId: '5',
    })
    const res = await POST(
      new Request('http://localhost/api/integrations/strava/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 1,
          aspect_type: 'create',
          owner_id: 5,
          subscription_id: 999,
          event_time: 1,
        }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it('POST accepts matching subscription and returns quickly', async () => {
    mocks.findUnique.mockResolvedValue({
      webhookId: 42,
      athleteId: '5',
    })
    const res = await POST(
      new Request('http://localhost/api/integrations/strava/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 1,
          aspect_type: 'create',
          owner_id: 5,
          subscription_id: 42,
          event_time: 1,
        }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
