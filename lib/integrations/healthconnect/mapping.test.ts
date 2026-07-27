import { describe, expect, it } from 'vitest'
import {
  humanType,
  isRawTypeLabel,
  mapSessionToDraft,
  normalizeExerciseTypeKey,
} from '@/lib/integrations/healthconnect/mapping'

describe('healthconnect mapping humanType', () => {
  it('aliases TYPE_79 / bare 79 / Type 79 to Walking', () => {
    expect(humanType('TYPE_79')).toBe('Walking')
    expect(humanType('79')).toBe('Walking')
    expect(humanType('Type 79')).toBe('Walking')
    expect(humanType('type_79')).toBe('Walking')
  })

  it('aliases common strength / run ints', () => {
    expect(humanType('TYPE_56')).toBe('Running')
    expect(humanType('70')).toBe('Strength Training')
    expect(humanType('Type 81')).toBe('Weightlifting')
  })

  it('normalizeExerciseTypeKey canonicalizes stubs', () => {
    expect(normalizeExerciseTypeKey('79')).toBe('TYPE_79')
    expect(normalizeExerciseTypeKey('Type 79')).toBe('TYPE_79')
    expect(normalizeExerciseTypeKey('WALKING')).toBe('WALKING')
  })

  it('isRawTypeLabel detects stubs worth rewriting', () => {
    expect(isRawTypeLabel('Type 79')).toBe(true)
    expect(isRawTypeLabel('TYPE_79')).toBe(true)
    expect(isRawTypeLabel('79')).toBe(true)
    expect(isRawTypeLabel('Walking')).toBe(false)
  })

  it('mapSessionToDraft prefers title, else human type', () => {
    const draft = mapSessionToDraft({
      id: 's1',
      exerciseType: 'Type 79',
      startTime: '2026-07-26T10:00:00.000Z',
      endTime: '2026-07-26T10:30:00.000Z',
      durationSec: 1800,
    })
    expect(draft.exercise).toBe('Walking')
  })
})
