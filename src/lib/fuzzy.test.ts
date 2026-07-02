import { describe, expect, it } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('empty needle scores 0 (matches anything)', () => {
    expect(fuzzyScore('anything', '')).toBe(0)
  })

  it('returns null when the needle is not a subsequence', () => {
    expect(fuzzyScore('strobe', 'xyz')).toBeNull()
    expect(fuzzyScore('abc', 'abcd')).toBeNull()
  })

  it('matches a subsequence, case-insensitively', () => {
    expect(fuzzyScore('Strobe', 'strob')).not.toBeNull()
    expect(fuzzyScore('deadmau5', 'dm5')).not.toBeNull()
  })

  it('ranks a contiguous start-of-word match above a scattered one', () => {
    const contiguous = fuzzyScore('Prog House', 'prog')
    const scattered = fuzzyScore('Paradigm Rough', 'prog') // p..r..o..g, not contiguous
    expect(contiguous).not.toBeNull()
    expect(scattered).not.toBeNull()
    expect(contiguous as number).toBeGreaterThan(scattered as number)
  })

  it('rewards a match at the start of a word', () => {
    const wordStart = fuzzyScore('bass house', 'house')
    const midWord = fuzzyScore('warehouse', 'house')
    expect((wordStart as number) > (midWord as number)).toBe(true)
  })
})
