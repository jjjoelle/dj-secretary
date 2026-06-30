import { useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useUi } from '../store/ui'
import { Modal, btn } from './common/widgets'
import { exportData, importData } from '../lib/backup'
import {
  chooseBackupFile,
  resumeAutoBackup,
  turnOffAutoBackup,
  noteManualBackup,
} from '../lib/autobackup'
import {
  restoreSnapshot,
  deleteSnapshot,
  downloadSnapshot,
  takeSnapshot,
  snapshotSummary,
} from '../lib/snapshots'

function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function BackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const snaps = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), [])
  const backupStatus = useUi((s) => s.backupStatus)
  const backupFileName = useUi((s) => s.backupFileName)
  const lastBackupAt = useUi((s) => s.lastBackupAt)
  const unsaved = useUi((s) => s.unsavedChanges)
  const fileInput = useRef<HTMLInputElement>(null)

  const onExport = async () => {
    await exportData()
    noteManualBackup()
  }
  const onImportFile = async (file: File) => {
    if (!confirm('Importing replaces your entire current library. Continue?')) return
    try {
      await takeSnapshot('before import')
      await importData(file)
      alert('Backup imported.')
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }
  const onRestore = async (id: string) => {
    if (!confirm('Restore this snapshot? It replaces your current library. A snapshot of the current state is taken first, so you can undo.')) return
    await takeSnapshot('before restore')
    await restoreSnapshot(id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Backup & restore" maxW="max-w-xl">
      <div className="space-y-5">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Auto-backup to a file</h3>
          {backupStatus === 'unsupported' ? (
            <p className="text-xs text-zinc-500">
              This browser can't auto-save to a file — use <span className="text-zinc-300">Export</span> below and watch
              the unsaved-changes reminder. (Chrome or Edge on desktop supports auto-backup.)
            </p>
          ) : backupStatus === 'on' ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
              <div className="min-w-0 text-xs text-emerald-200">
                Auto-saving to <span className="font-medium">{backupFileName}</span>
                {lastBackupAt && <span className="text-emerald-300/70"> · last saved {when(lastBackupAt)}</span>}
              </div>
              <button className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100" onClick={() => void turnOffAutoBackup()}>
                Turn off
              </button>
            </div>
          ) : backupStatus === 'needs-permission' ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2">
              <div className="min-w-0 text-xs text-amber-200">
                Resume auto-backup to <span className="font-medium">{backupFileName}</span>.
              </div>
              <div className="flex shrink-0 gap-2">
                <button className={btn.primary} onClick={() => void resumeAutoBackup()}>
                  Resume
                </button>
                <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={() => void turnOffAutoBackup()}>
                  Turn off
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Pick a file once; the app keeps it updated automatically as you work. Save it in iCloud / Dropbox / Drive
                for an automatic off-device copy.
              </p>
              <button className={btn.primary} onClick={() => void chooseBackupFile()}>
                Choose backup file…
              </button>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Manual backup</h3>
          <div className="flex gap-2">
            <button className={btn.ghost} onClick={() => void onExport()}>
              Export to file
            </button>
            <button className={btn.ghost} onClick={() => fileInput.current?.click()}>
              Import…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportFile(f)
                e.target.value = ''
              }}
            />
          </div>
          {unsaved > 0 && backupStatus !== 'on' && (
            <p className="mt-1.5 text-xs text-amber-400">
              {unsaved} change{unsaved === 1 ? '' : 's'} since your last backup.
            </p>
          )}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Snapshots</h3>
            <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={() => void takeSnapshot('manual')}>
              Take snapshot now
            </button>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            Automatic local recovery points (last 10). Restoring replaces your current library; your other snapshots are kept.
          </p>
          <ul className="max-h-[32vh] space-y-1 overflow-y-auto">
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
            {snaps && snaps.length === 0 && <li className="px-1 py-2 text-xs text-zinc-500">No snapshots yet.</li>}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
