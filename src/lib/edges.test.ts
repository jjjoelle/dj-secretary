import { describe, expect, it } from 'vitest'
import { allEdgeTags, edgesWithTags } from './edges'
import type { Edge } from '../types'

const mk = (id: string, tags: string[]): Edge => ({
  id,
  fromTrackId: 'a',
  toTrackId: 'b',
  tags,
  createdAt: 0,
})

describe('edge tag helpers', () => {
  it('allEdgeTags dedupes and sorts', () => {
    expect(allEdgeTags([mk('1', ['?', 'bass']), mk('2', ['bass', 'key'])])).toEqual(['?', 'bass', 'key'])
  })

  it('edgesWithTags filters by AND; empty selection returns all', () => {
    const es = [mk('1', ['?']), mk('2', ['?', 'bass']), mk('3', [])]
    expect(edgesWithTags(es, []).map((e) => e.id)).toEqual(['1', '2', '3'])
    expect(edgesWithTags(es, ['?']).map((e) => e.id)).toEqual(['1', '2'])
    expect(edgesWithTags(es, ['?', 'bass']).map((e) => e.id)).toEqual(['2'])
  })

  it('tolerates edges with a missing tags array', () => {
    const legacy = { id: 'x', fromTrackId: 'a', toTrackId: 'b', createdAt: 0 } as unknown as Edge
    expect(allEdgeTags([legacy])).toEqual([])
    expect(edgesWithTags([legacy], ['?'])).toEqual([])
  })
})
