import { describe, expect, it } from 'vitest'

/**
 * Contract mirror of classifyFlushStatus in
 * mypens-mobile/lib/offlineQueue.ts — keep in sync when flush policy changes.
 *
 * 401/403 must retry (token/config), not silent-drop.
 * Other 4xx → dead letter. 2xx / delete-404 → success. 5xx → retry.
 */
function classifyFlushStatus(
  status: number,
  opts?: { treat404AsSuccess?: boolean },
): 'success' | 'retry' | 'dead_letter' {
  if (status >= 200 && status < 300) return 'success'
  if (opts?.treat404AsSuccess && status === 404) return 'success'
  if (status === 401 || status === 403 || status >= 500) return 'retry'
  if (status >= 400 && status < 500) return 'dead_letter'
  return 'retry'
}

describe('offlineQueue flush classification', () => {
  it('treats 2xx as success', () => {
    expect(classifyFlushStatus(200)).toBe('success')
    expect(classifyFlushStatus(201)).toBe('success')
  })

  it('keeps 401/403 in queue (retryable auth)', () => {
    expect(classifyFlushStatus(401)).toBe('retry')
    expect(classifyFlushStatus(403)).toBe('retry')
  })

  it('retries server errors', () => {
    expect(classifyFlushStatus(500)).toBe('retry')
    expect(classifyFlushStatus(503)).toBe('retry')
  })

  it('dead-letters genuinely rejected 4xx (not silent drop)', () => {
    expect(classifyFlushStatus(400)).toBe('dead_letter')
    expect(classifyFlushStatus(404)).toBe('dead_letter')
    expect(classifyFlushStatus(422)).toBe('dead_letter')
  })

  it('treats delete 404 as success when opted in', () => {
    expect(classifyFlushStatus(404, { treat404AsSuccess: true })).toBe('success')
  })
})
