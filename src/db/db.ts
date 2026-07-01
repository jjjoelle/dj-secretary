import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Track, Annotation, Edge, Playlist, TrackSet, Snapshot, Meta, SmartCrate, Folder, FilterQuery } from '../types'

// Local-first storage. Everything lives in the browser (IndexedDB); no backend.
export class DjDb extends Dexie {
  tracks!: Table<Track, string>
  annotations!: Table<Annotation, string>
  edges!: Table<Edge, string>
  playlists!: Table<Playlist, string>
  sets!: Table<TrackSet, string>
  snapshots!: Table<Snapshot, string>
  meta!: Table<Meta, string>
  smartCrates!: Table<SmartCrate, string>
  folders!: Table<Folder, string>

  constructor() {
    super('dj-secretary')
    this.version(1).stores({
      tracks: 'id, title, artist, createdAt',
      annotations: 'id, trackId, timestampSec',
      edges: 'id, fromTrackId, toTrackId',
      playlists: 'id, name, createdAt',
    })
    // v2 adds Sets (graph-aware ordered routes). Existing tables carry over.
    this.version(2).stores({
      sets: 'id, name, createdAt',
    })
    // v3 adds local recovery snapshots and gives every edge a tags[] array.
    this.version(3)
      .stores({ snapshots: 'id, createdAt' })
      .upgrade(async (tx) => {
        await tx
          .table('edges')
          .toCollection()
          .modify((e: Edge) => {
            if (!Array.isArray(e.tags)) e.tags = []
          })
      })
    // v4 adds a small key/value store (auto-backup file handle, etc.).
    this.version(4).stores({ meta: 'key' })
    // v5 adds smart crates (saved filters). New empty table ⇒ no upgrade().
    this.version(5).stores({ smartCrates: 'id, name, createdAt' })
    // v6 adds folders (sidebar grouping for playlists/sets). `folderId` on
    // playlists/sets is optional ⇒ no upgrade/backfill needed.
    this.version(6).stores({ folders: 'id, name, kind, createdAt' })
  }
}

export const db = new DjDb()

// Fire listeners on any write to the main tables (auto-backup uses this to know
// the library changed). Hooks are registered once, here at module load, so they
// don't depend on any component/init having run.
type DbChangeListener = () => void
const dbChangeListeners = new Set<DbChangeListener>()
export function onDbChange(fn: DbChangeListener): () => void {
  dbChangeListeners.add(fn)
  return () => {
    dbChangeListeners.delete(fn)
  }
}
function emitDbChange(): void {
  dbChangeListeners.forEach((fn) => fn())
}
;[db.tracks, db.annotations, db.edges, db.playlists, db.sets, db.smartCrates, db.folders].forEach((table) => {
  const t = table as unknown as { hook: (ev: 'creating' | 'updating' | 'deleting', fn: () => void) => void }
  t.hook('creating', emitDbChange)
  t.hook('updating', emitDbChange)
  t.hook('deleting', emitDbChange)
})

export function newId(): string {
  return crypto.randomUUID()
}

// ---- Tracks ----

export async function createTrack(data: Partial<Track> & { title: string; artist: string }): Promise<string> {
  const id = newId()
  const track: Track = {
    id,
    title: data.title,
    artist: data.artist,
    durationSec: data.durationSec,
    bpm: data.bpm,
    key: data.key,
    genre: data.genre,
    energy: data.energy,
    tags: data.tags ?? [],
    notes: data.notes,
    spotifyId: data.spotifyId,
    albumArtUrl: data.albumArtUrl,
    position: data.position,
    createdAt: Date.now(),
  }
  await db.tracks.add(track)
  return id
}

export async function updateTrack(id: string, changes: Partial<Track>): Promise<void> {
  await db.tracks.update(id, changes)
}

// Cascade: remove the track, its annotations, any edges touching it, and pull it
// out of every playlist.
export async function deleteTrack(id: string): Promise<void> {
  await db.transaction('rw', db.tracks, db.annotations, db.edges, db.playlists, db.sets, async () => {
    await db.annotations.where('trackId').equals(id).delete()
    await db.edges.where('fromTrackId').equals(id).delete()
    await db.edges.where('toTrackId').equals(id).delete()
    await db.tracks.delete(id)
    for (const pl of await db.playlists.toArray()) {
      if (pl.trackIds.includes(id)) {
        await db.playlists.update(pl.id, { trackIds: pl.trackIds.filter((t) => t !== id) })
      }
    }
    for (const s of await db.sets.toArray()) {
      if (s.trackIds.includes(id)) {
        await db.sets.update(s.id, { trackIds: s.trackIds.filter((t) => t !== id) })
      }
    }
  })
}

// ---- Annotations ----

export async function addAnnotation(data: Omit<Annotation, 'id'>): Promise<string> {
  const id = newId()
  await db.annotations.add({ ...data, id })
  return id
}

export async function updateAnnotation(id: string, changes: Partial<Annotation>): Promise<void> {
  await db.annotations.update(id, changes)
}

// Deleting an annotation also clears any edge cue references that pointed at it.
export async function deleteAnnotation(id: string): Promise<void> {
  await db.transaction('rw', db.annotations, db.edges, async () => {
    await db.annotations.delete(id)
    const refEdges = await db.edges
      .filter((e) => e.exitCueId === id || e.entryCueId === id)
      .toArray()
    for (const e of refEdges) {
      await db.edges.update(e.id, {
        exitCueId: e.exitCueId === id ? undefined : e.exitCueId,
        entryCueId: e.entryCueId === id ? undefined : e.entryCueId,
      })
    }
  })
}

// ---- Edges (transitions) ----

export async function addEdge(
  data: Omit<Edge, 'id' | 'createdAt' | 'tags'> & { tags?: string[] },
): Promise<string> {
  const id = newId()
  await db.edges.add({ tags: [], ...data, id, createdAt: Date.now() })
  return id
}

export async function updateEdge(id: string, changes: Partial<Edge>): Promise<void> {
  await db.edges.update(id, changes)
}

export async function deleteEdge(id: string): Promise<void> {
  await db.edges.delete(id)
}

// ---- Playlists ----

export async function createPlaylist(name: string): Promise<string> {
  const id = newId()
  await db.playlists.add({ id, name, trackIds: [], createdAt: Date.now() })
  return id
}

export async function updatePlaylist(id: string, changes: Partial<Playlist>): Promise<void> {
  await db.playlists.update(id, changes)
}

export async function deletePlaylist(id: string): Promise<void> {
  await db.playlists.delete(id)
}

// ---- Sets (graph-aware ordered routes) ----

export async function createSet(name: string): Promise<string> {
  const id = newId()
  await db.sets.add({ id, name, trackIds: [], createdAt: Date.now() })
  return id
}

export async function updateSet(id: string, changes: Partial<TrackSet>): Promise<void> {
  await db.sets.update(id, changes)
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id)
}

// ---- Smart crates (saved filters) ----

export async function createSmartCrate(name: string, query: FilterQuery): Promise<string> {
  const id = newId()
  await db.smartCrates.add({ id, name, query, createdAt: Date.now() })
  return id
}

export async function updateSmartCrate(id: string, changes: Partial<SmartCrate>): Promise<void> {
  await db.smartCrates.update(id, changes)
}

export async function deleteSmartCrate(id: string): Promise<void> {
  await db.smartCrates.delete(id)
}

// ---- Folders (sidebar grouping for playlists/sets) ----

export async function createFolder(name: string, kind: 'playlist' | 'set'): Promise<string> {
  const id = newId()
  await db.folders.add({ id, name, kind, createdAt: Date.now() })
  return id
}

export async function updateFolder(id: string, changes: Partial<Folder>): Promise<void> {
  await db.folders.update(id, changes)
}

// Re-parent children to the top level (clear their folderId), then delete the
// folder — all in one rw txn. `folderId` isn't indexed, so filter in memory
// rather than using .where('folderId') (which would throw).
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.folders, db.playlists, db.sets, async () => {
    for (const pl of (await db.playlists.toArray()).filter((p) => p.folderId === id)) {
      await db.playlists.update(pl.id, { folderId: undefined })
    }
    for (const s of (await db.sets.toArray()).filter((s) => s.folderId === id)) {
      await db.sets.update(s.id, { folderId: undefined })
    }
    await db.folders.delete(id)
  })
}

// ---- Meta (key/value app settings) ----

export async function metaGet<T = unknown>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function metaDelete(key: string): Promise<void> {
  await db.meta.delete(key)
}
