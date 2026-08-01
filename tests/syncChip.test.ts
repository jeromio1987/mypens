import { describe, expect, it } from 'vitest'
import { buildSyncChipState, type SyncSourceStatus } from '../lib/syncChip'

function src(partial: Partial<SyncSourceStatus> & Pick<SyncSourceStatus, 'id' | 'label'>): SyncSourceStatus {
  return {
    connected: false,
    lastSuccessAt: null,
    lastError: null,
    lastErrorAt: null,
    ...partial,
  }
}

describe('buildSyncChipState', () => {
  it('never marks healthy when there is no success', () => {
    const state = buildSyncChipState([
      src({ id: 'garmin', label: 'Garmin', connected: false }),
      src({ id: 'healthconnect', label: 'Health Connect', connected: false }),
    ])
    expect(state.healthy).toBe(false)
    expect(state.tone).toBe('unknown')
    expect(state.primaryError).toBeNull()
  })

  it('surfaces fetch/status errors even when disconnected', () => {
    const state = buildSyncChipState([
      src({
        id: 'garmin',
        label: 'Garmin',
        connected: false,
        lastError: 'status 401',
        lastErrorAt: '2026-07-28T00:00:00.000Z',
      }),
    ])
    expect(state.tone).toBe('error')
    expect(state.primaryError?.message).toBe('status 401')
    expect(state.healthy).toBe(false)
  })

  it('is ok only with a success and no errors', () => {
    const state = buildSyncChipState([
      src({
        id: 'garmin',
        label: 'Garmin',
        connected: true,
        lastSuccessAt: '2026-07-27T12:00:00.000Z',
      }),
    ])
    expect(state.healthy).toBe(true)
    expect(state.tone).toBe('ok')
    expect(state.lastAnySuccessAt).toBe('2026-07-27T12:00:00.000Z')
  })
})
