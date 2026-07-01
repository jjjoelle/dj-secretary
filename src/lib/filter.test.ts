import { describe, expect, it } from 'vitest'
import { emptyQuery, filterTracks, isQueryActive, matchesQuery } from './filter'
import type { Track } from '../types'

const mk = (id: string, p: Partial<Track> = {}): Track => ({
  id,
  title: p.title ?? id,
  artist: p.artist ?? 'a',
  tags: p.tags ?? [],
  bpm: p.bpm,
  key: p.key,
  genre: p.genre,
  energy: p.energy,
  durationSec: p.durationSec,
  createdAt: 0,
})

const ids = (ts: Track[]) => ts.map((t) => t.id)

describe('filter query', () => {
  it('empty query is inactive and passes everything through (same array contents)', () => {
    const ts = [mk('1'), mk('2')]
    expect(isQueryActive(emptyQuery())).toBe(false)
    expect(ids(filterTracks(ts, {}))).toEqual(['1', '2'])
  })

  it('tag mode all = AND', () => {
    const ts = [mk('1', { tags: ['x', 'y'] }), mk('2', { tags: ['x'] }), mk('3', { tags: ['y'] })]
    expect(ids(filterTracks(ts, { includeTags: ['x', 'y'], tagMode: 'all' }))).toEqual(['1'])
  })

  it('tag mode all is the default when omitted', () => {
    const ts = [mk('1', { tags: ['x', 'y'] }), mk('2', { tags: ['x'] })]
    expect(ids(filterTracks(ts, { includeTags: ['x', 'y'] }))).toEqual(['1'])
  })

  it('tag mode any = OR', () => {
    const ts = [mk('1', { tags: ['x'] }), mk('2', { tags: ['y'] }), mk('3', { tags: ['z'] })]
    expect(ids(filterTracks(ts, { includeTags: ['x', 'y'], tagMode: 'any' }))).toEqual(['1', '2'])
  })

  it('tag mode none = NOT (has none of the listed tags)', () => {
    const ts = [mk('1', { tags: ['x'] }), mk('2', { tags: ['y'] }), mk('3', { tags: ['z'] })]
    expect(ids(filterTracks(ts, { includeTags: ['x', 'y'], tagMode: 'none' }))).toEqual(['3'])
  })

  it('excludeTags drops any track carrying an excluded tag, regardless of mode', () => {
    const ts = [mk('1', { tags: ['peak', 'vocal'] }), mk('2', { tags: ['peak'] })]
    expect(ids(filterTracks(ts, { includeTags: ['peak'], tagMode: 'any', excludeTags: ['vocal'] }))).toEqual(['2'])
  })

  it('bpm range is inclusive and excludes tracks with no bpm when bounded', () => {
    const ts = [mk('1', { bpm: 118 }), mk('2', { bpm: 124 }), mk('3', { bpm: 130 }), mk('4', {})]
    expect(ids(filterTracks(ts, { bpmMin: 120, bpmMax: 128 }))).toEqual(['2'])
    expect(ids(filterTracks(ts, { bpmMin: 124 }))).toEqual(['2', '3'])
    expect(ids(filterTracks(ts, { bpmMax: 124 }))).toEqual(['1', '2'])
  })

  it('energy and duration ranges work like bpm', () => {
    const ts = [mk('1', { energy: 3, durationSec: 120 }), mk('2', { energy: 8, durationSec: 360 })]
    expect(ids(filterTracks(ts, { energyMin: 5 }))).toEqual(['2'])
    expect(ids(filterTracks(ts, { durationMax: 200 }))).toEqual(['1'])
  })

  it('key / genre / artist are membership filters', () => {
    const ts = [
      mk('1', { key: '8A', genre: 'House', artist: 'X' }),
      mk('2', { key: '9A', genre: 'Trance', artist: 'Y' }),
      mk('3', {}),
    ]
    expect(ids(filterTracks(ts, { keys: ['8A'] }))).toEqual(['1'])
    expect(ids(filterTracks(ts, { genres: ['House', 'Trance'] }))).toEqual(['1', '2'])
    expect(ids(filterTracks(ts, { artists: ['Y'] }))).toEqual(['2'])
  })

  it('combines dimensions with AND', () => {
    const ts = [
      mk('1', { bpm: 124, tags: ['peak'], genre: 'House' }),
      mk('2', { bpm: 124, tags: ['warmup'], genre: 'House' }),
      mk('3', { bpm: 100, tags: ['peak'], genre: 'House' }),
    ]
    expect(ids(filterTracks(ts, { bpmMin: 120, includeTags: ['peak'], genres: ['House'] }))).toEqual(['1'])
  })

  it('matchesQuery text searches title/artist/genre/tags', () => {
    const t = mk('1', { title: 'Strobe', artist: 'deadmau5', genre: 'Progressive', tags: ['peak'] })
    expect(matchesQuery(t, { text: 'strob' })).toBe(true)
    expect(matchesQuery(t, { text: 'deadmau' })).toBe(true)
    expect(matchesQuery(t, { text: 'prog' })).toBe(true)
    expect(matchesQuery(t, { text: 'peak' })).toBe(true)
    expect(matchesQuery(t, { text: 'nope' })).toBe(false)
  })
})
