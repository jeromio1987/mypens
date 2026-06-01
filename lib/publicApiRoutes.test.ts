import { describe, expect, it } from 'vitest'
import { isPublicApiRoute } from '@/lib/publicApiRoutes'

describe('isPublicApiRoute', () => {
  it('allows health and auth endpoints', () => {
    expect(isPublicApiRoute('/api/health')).toBe(true)
    expect(isPublicApiRoute('/api/auth/login')).toBe(true)
    expect(isPublicApiRoute('/api/auth/logout')).toBe(true)
  })

  it('allows integration webhooks, callbacks, crons, and public API', () => {
    expect(isPublicApiRoute('/api/integrations/strava/webhook')).toBe(true)
    expect(isPublicApiRoute('/api/integrations/strava/callback')).toBe(true)
    expect(isPublicApiRoute('/api/integrations/garmin/webhook')).toBe(true)
    expect(isPublicApiRoute('/api/integrations/healthkit/ingest')).toBe(true)
    expect(isPublicApiRoute('/api/integrations/healthconnect/ingest')).toBe(true)
    expect(isPublicApiRoute('/api/cron/foo')).toBe(true)
    expect(isPublicApiRoute('/api/public/snapshot')).toBe(true)
  })

  it('does not treat private API paths as public', () => {
    expect(isPublicApiRoute('/api/weight')).toBe(false)
    expect(isPublicApiRoute('/api/food')).toBe(false)
    expect(isPublicApiRoute('/api/integrations/strava/import')).toBe(false)
  })
})
