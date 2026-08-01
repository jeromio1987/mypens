import { describe, expect, it } from 'vitest'

import { isPublicApiRoute } from '@/lib/publicApiRoutes'



describe('isPublicApiRoute', () => {

  it('allows health and auth endpoints', () => {

    expect(isPublicApiRoute('/api/health')).toBe(true)

    expect(isPublicApiRoute('/api/auth/login')).toBe(true)

    expect(isPublicApiRoute('/api/auth/logout')).toBe(true)

    expect(isPublicApiRoute('/api/auth/session')).toBe(true)

  })



  it('allows integration webhooks, callbacks, crons, and public API', () => {

    expect(isPublicApiRoute('/api/integrations/strava/webhook')).toBe(true)

    expect(isPublicApiRoute('/api/integrations/strava/callback')).toBe(true)

    expect(isPublicApiRoute('/api/integrations/garmin/webhook')).toBe(true)

    expect(isPublicApiRoute('/api/integrations/healthkit/ingest')).toBe(true)

    expect(isPublicApiRoute('/api/integrations/healthconnect/ingest')).toBe(true)

    expect(isPublicApiRoute('/api/integrations/healthconnect/sleep-ingest')).toBe(true)

    expect(isPublicApiRoute('/api/cron/cleanup-skipped-tombstones')).toBe(true)

    expect(isPublicApiRoute('/api/cron/check-stale-pairings')).toBe(true)

    expect(isPublicApiRoute('/api/public/snapshot')).toBe(true)

  })



  it('uses path-segment boundaries (no open prefix inheritance)', () => {

    expect(isPublicApiRoute('/api/health-debug')).toBe(false)

    expect(isPublicApiRoute('/api/healthx')).toBe(false)

    expect(isPublicApiRoute('/api/auth/login-extra')).toBe(false)

    expect(isPublicApiRoute('/api/public/snapshot-extra')).toBe(false)

  })



  it('does not treat unknown cron/public paths as public (fail closed)', () => {

    expect(isPublicApiRoute('/api/cron/foo')).toBe(false)

    expect(isPublicApiRoute('/api/cron/unknown-job')).toBe(false)

    expect(isPublicApiRoute('/api/cron/')).toBe(false)

    expect(isPublicApiRoute('/api/public/other')).toBe(false)

    expect(isPublicApiRoute('/api/public/')).toBe(false)

  })



  it('does not treat private API paths as public', () => {

    expect(isPublicApiRoute('/api/weight')).toBe(false)

    expect(isPublicApiRoute('/api/food')).toBe(false)

    expect(isPublicApiRoute('/api/export')).toBe(false)

    expect(isPublicApiRoute('/api/import')).toBe(false)

    expect(isPublicApiRoute('/api/integrations/strava/import')).toBe(false)

  })

})


