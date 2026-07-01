import { db, newId } from '../db/db'
import { gatherBackup, applyBackup, type BackupData } from './backup'
import type { Snapshot } from '../types'

// Local recovery snapshots: full-DB JSON blobs, ring-buffered to the most recent
// MAX. Independent of the portable JSON backup; they survive a restore so you can
// always roll back again.
const MAX_SNAPSHOTS = 10

async function prune(): Promise<void> {
  const all = await db.snapshots.orderBy('createdAt').reverse().toArray()
  const excess = all.slice(MAX_SNAPSHOTS)
  if (excess.length) await db.snapshots.bulkDelete(excess.map((s) => s.id))
}

async function add(json: string, label?: string): Promise<void> {
  await db.snapshots.add({ id: newId(), createdAt: Date.now(), label, json })
  await prune()
}

// Always create a snapshot (e.g. a manual "snapshot now" or before a destructive op).
export async function takeSnapshot(label?: string): Promise<void> {
  const data = await gatherBackup()
  await add(JSON.stringify(data), label)
}

// Create a snapshot only if the DB content differs from the most recent one —
// used on startup so we don't accumulate identical snapshots.
export async function autoSnapshot(label?: string): Promise<void> {
  const json = JSON.stringify(await gatherBackup())
  const last = await db.snapshots.orderBy('createdAt').last()
  if (last && stripExportedAt(last.json) === stripExportedAt(json)) return
  await add(json, label)
}

// exportedAt changes every gather; ignore it when comparing for "did anything change".
function stripExportedAt(json: string): string {
  try {
    const o = JSON.parse(json) as Partial<BackupData>
    delete o.exportedAt
    return JSON.stringify(o)
  } catch {
    return json
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray()
}

export async function restoreSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id)
  if (!snap) throw new Error('Snapshot not found')
  await applyBackup(JSON.parse(snap.json) as Partial<BackupData>)
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id)
}

export function downloadSnapshot(snap: Snapshot): void {
  const blob = new Blob([snap.json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dj-secretary-snapshot-${new Date(snap.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Summarize a snapshot's contents for the UI without storing extra fields.
export function snapshotSummary(snap: Snapshot): string {
  try {
    const o = JSON.parse(snap.json) as Partial<BackupData>
    const parts = [
      `${o.tracks?.length ?? 0} tracks`,
      `${o.edges?.length ?? 0} transitions`,
      `${o.sets?.length ?? 0} sets`,
    ]
    // Only mention the newer tables when present, so two recovery points that
    // differ only in crates/folders are distinguishable in the list.
    if (o.smartCrates?.length) parts.push(`${o.smartCrates.length} crates`)
    if (o.folders?.length) parts.push(`${o.folders.length} folders`)
    return parts.join(' · ')
  } catch {
    return ''
  }
}
