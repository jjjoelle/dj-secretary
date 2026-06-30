import { db } from '../db/db'
import type { Track, Annotation, Edge, Playlist, TrackSet } from '../types'

export interface BackupData {
  app: 'dj-secretary'
  version: 2
  exportedAt: string
  tracks: Track[]
  annotations: Annotation[]
  edges: Edge[]
  playlists: Playlist[]
  sets: TrackSet[]
}

// The tables included in a portable backup. A test asserts this equals the live
// Dexie schema (minus local-only `snapshots`) so a newly-added table can never
// again be silently dropped from exports — which is exactly the bug where Sets
// were lost on every export/import round-trip.
export const BACKUP_TABLES = ['tracks', 'annotations', 'edges', 'playlists', 'sets'] as const

// Gather the whole portable DB into a backup object (also used for snapshots).
export async function gatherBackup(): Promise<BackupData> {
  const [tracks, annotations, edges, playlists, sets] = await Promise.all([
    db.tracks.toArray(),
    db.annotations.toArray(),
    db.edges.toArray(),
    db.playlists.toArray(),
    db.sets.toArray(),
  ])
  return {
    app: 'dj-secretary',
    version: 2,
    exportedAt: new Date().toISOString(),
    tracks,
    annotations,
    edges,
    playlists,
    sets,
  }
}

// Replace the entire DB with a backup payload. Accepts v1 (no `sets`) and v2,
// and backfills edge `tags` for pre-tag exports. Leaves the local-only
// `snapshots` table untouched so recovery history survives a restore.
export async function applyBackup(data: Partial<BackupData>): Promise<void> {
  const edges = (data.edges ?? []).map((e) => ({ ...e, tags: e.tags ?? [] }))
  await db.transaction('rw', db.tracks, db.annotations, db.edges, db.playlists, db.sets, async () => {
    await Promise.all([
      db.tracks.clear(),
      db.annotations.clear(),
      db.edges.clear(),
      db.playlists.clear(),
      db.sets.clear(),
    ])
    await db.tracks.bulkAdd(data.tracks ?? [])
    await db.annotations.bulkAdd(data.annotations ?? [])
    await db.edges.bulkAdd(edges)
    await db.playlists.bulkAdd(data.playlists ?? [])
    await db.sets.bulkAdd(data.sets ?? [])
  })
}

export async function exportData(): Promise<void> {
  const data = await gatherBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dj-secretary-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<void> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<BackupData>
  if (data.app !== 'dj-secretary' || !Array.isArray(data.tracks)) {
    throw new Error('Not a DJ Secretary backup file')
  }
  await applyBackup(data)
}
