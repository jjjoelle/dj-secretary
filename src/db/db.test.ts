import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  createTrack,
  addAnnotation,
  addEdge,
  createPlaylist,
  updatePlaylist,
  createSet,
  updateSet,
  deleteTrack,
} from './db'

beforeEach(async () => {
  await Promise.all([
    db.tracks.clear(),
    db.annotations.clear(),
    db.edges.clear(),
    db.playlists.clear(),
    db.sets.clear(),
  ])
})

describe('deleteTrack cascade', () => {
  it('removes its annotations, any edges touching it, and its playlist/set membership', async () => {
    const a = await createTrack({ title: 'A', artist: 'x', tags: [] })
    const b = await createTrack({ title: 'B', artist: 'y', tags: [] })
    await addAnnotation({ trackId: a, timestampSec: 5, type: 'cue_in' })
    await addEdge({ fromTrackId: a, toTrackId: b, tags: [] })
    await addEdge({ fromTrackId: b, toTrackId: a, tags: [] })
    const pl = await createPlaylist('PL')
    await updatePlaylist(pl, { trackIds: [a, b] })
    const st = await createSet('S')
    await updateSet(st, { trackIds: [a, b] })

    await deleteTrack(a)

    expect(await db.tracks.get(a)).toBeUndefined()
    expect(await db.annotations.where('trackId').equals(a).count()).toBe(0)
    expect(await db.edges.count()).toBe(0) // both edges referenced A
    expect((await db.playlists.get(pl))?.trackIds).toEqual([b])
    expect((await db.sets.get(st))?.trackIds).toEqual([b])
    expect(await db.tracks.get(b)).toBeDefined()
  })
})
