import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Modal, btn } from './common/widgets'
import {
  restoreSnapshot,
  deleteSnapshot,
  downloadSnapshot,
  takeSnapshot,
  snapshotSummary,
} from '../lib/snapshots'

function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SnapshotsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snaps = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), [])

  const onRestore = async (id: string) => {
    if (!confirm('Restore this snapshot? It replaces your current library. A snapshot of the current state is taken first, so you can undo.')) return
    await takeSnapshot('before restore')
    await restoreSnapshot(id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Snapshots & restore" maxW="max-w-xl">
      <p className="mb-3 text-xs text-zinc-500">
        Automatic local recovery points (the most recent 10). Restoring replaces your current library;
        your other snapshots are kept.
      </p>
      <div className="mb-3">
        <button className={btn.ghost} onClick={() => void takeSnapshot('manual')}>
          Take snapshot now
        </button>
      </div>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
        {(snaps ?? []).map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-md border border-edge bg-panel2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-100">
                {when(s.createdAt)}
                {s.label && <span className="text-zinc-500"> · {s.label}</span>}
              </div>
              <div className="text-xs text-zinc-500">{snapshotSummary(s)}</div>
            </div>
            <button className="text-xs text-zinc-300 hover:text-accent" onClick={() => void onRestore(s.id)}>
              Restore
            </button>
            <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={() => downloadSnapshot(s)}>
              Download
            </button>
            <button
              className="text-xs text-zinc-500 hover:text-rose-400"
              onClick={() => void deleteSnapshot(s.id)}
              aria-label="Delete snapshot"
            >
              ✕
            </button>
          </li>
        ))}
        {snaps && snaps.length === 0 && (
          <li className="px-1 py-2 text-xs text-zinc-500">No snapshots yet.</li>
        )}
      </ul>
    </Modal>
  )
}
