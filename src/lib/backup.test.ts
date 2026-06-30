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
} from '../db/db'
import { gatherBackup, applyBackup, BACKUP_TABLES, type BackupData } from './backup'

async function clearAll() {
  await Promise.all([
    db.tracks.clear(),
    db.annotations.clear(),
    db.edges.clear(),
    db.playlists.clear(),
    db.sets.clear(),
    db.snapshots.clear(),
  ])
}

beforeEach(clearAll)

describe('backup', () => {
  it('round-trips every table including sets and edge tags', async () => {
    const a = await createTrack({ title: 'A', artist: 'x', tags: [] })
    const b = await createTrack({ title: 'B', artist: 'y', tags: [] })
    await addAnnotation({ trackId: a, timestampSec: 10, type: 'cue_in', text: 'in' })
    await addEdge({ fromTrackId: a, toTrackId: b, technique: 'swap', rating: 5, tags: ['?', 'bass swap'] })
    const pl = await createPlaylist('PL')
    await updatePlaylist(pl, { trackIds: [a, b] })
    const st = await createSet('SET')
    await updateSet(st, { trackIds: [a, b] })

    const backup = await gatherBackup()
    expect(backup.sets).toHaveLength(1)
    expect(backup.edges[0].tags).toEqual(['?', 'bass swap'])

    await clearAll()
    expect(await db.tracks.count()).toBe(0)

    await applyBackup(backup)

    expect(await db.tracks.count()).toBe(2)
    expect(await db.annotations.count()).toBe(1)
    expect(await db.sets.count()).toBe(1) // the regression: sets must survive a round-trip
    expect((await db.sets.get(st))?.trackIds).toEqual([a, b])
    expect((await db.playlists.get(pl))?.trackIds).toEqual([a, b])
    expect((await db.edges.toArray())[0].tags).toEqual(['?', 'bass swap'])
  })

  it('accepts a v1 backup (no sets) and backfills missing edge tags', async () => {
    const legacy = {
      app: 'dj-secretary',
      version: 1,
      tracks: [{ id: 't', title: 'A', artist: 'x', tags: [], createdAt: 1 }],
      annotations: [],
      edges: [{ id: 'e', fromTrackId: 't', toTrackId: 't', createdAt: 1 }],
      playlists: [],
      // no `sets` key at all
    } as unknown as Partial<BackupData>

    await applyBackup(legacy)
    expect(await db.sets.count()).toBe(0)
    expect((await db.edges.get('e'))?.tags).toEqual([])
  })

  it('BACKUP_TABLES matches the live schema (minus local-only snapshots)', () => {
    const live = db.tables
      .map((t) => t.name)
      .filter((n) => n !== 'snapshots')
      .sort()
    expect([...BACKUP_TABLES].sort()).toEqual(live)
  })
})
