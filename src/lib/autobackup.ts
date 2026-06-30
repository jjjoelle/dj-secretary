import { metaGet, metaSet, metaDelete, onDbChange } from '../db/db'
import { gatherBackup } from './backup'
import { useUi } from '../store/ui'

// Auto-backup the whole library to a real file the user picks once (File System
// Access API). The file handle is persisted, so across sessions we only need a
// one-tap permission re-grant. Park the file in iCloud/Dropbox for off-device safety.

const HANDLE_KEY = 'autoBackupHandle'
const DEBOUNCE_MS = 4000

// Minimal FS Access types (not consistently in TS lib.dom).
interface FsWritable {
  write(data: string | Blob | BufferSource): Promise<void>
  close(): Promise<void>
}
interface FsFileHandle {
  name: string
  createWritable(): Promise<FsWritable>
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>
}
type SaveFilePicker = (opts?: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<FsFileHandle>

function picker(): SaveFilePicker | null {
  const w = window as unknown as { showSaveFilePicker?: SaveFilePicker }
  return typeof w.showSaveFilePicker === 'function' ? w.showSaveFilePicker : null
}

export function fsAccessSupported(): boolean {
  return picker() !== null
}

let currentHandle: FsFileHandle | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inited = false

async function writeNow(): Promise<boolean> {
  if (!currentHandle) return false
  try {
    const json = JSON.stringify(await gatherBackup(), null, 2)
    const w = await currentHandle.createWritable()
    await w.write(json)
    await w.close()
    useUi.getState().setBackup('on', currentHandle.name)
    useUi.getState().markBackedUp(Date.now())
    return true
  } catch {
    // Most likely the per-session permission lapsed — ask the user to resume.
    useUi.getState().setBackup('needs-permission')
    return false
  }
}

function scheduleFlush() {
  if (useUi.getState().backupStatus !== 'on') return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void writeNow(), DEBOUNCE_MS)
}

function onChange() {
  useUi.getState().bumpUnsaved()
  scheduleFlush()
}

async function permState(handle: FsFileHandle): Promise<PermissionState> {
  if (!handle.queryPermission) return 'granted'
  try {
    return await handle.queryPermission({ mode: 'readwrite' })
  } catch {
    return 'prompt'
  }
}

export async function initAutoBackup(): Promise<void> {
  if (inited) return
  inited = true

  // Catch every write to the main tables (hooks live in db.ts, registered once).
  onDbChange(onChange)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && useUi.getState().backupStatus === 'on') void writeNow()
  })

  if (!fsAccessSupported()) {
    useUi.getState().setBackup('unsupported')
    return
  }
  const saved = await metaGet<FsFileHandle>(HANDLE_KEY)
  if (!saved) {
    useUi.getState().setBackup('off')
    return
  }
  currentHandle = saved
  const state = await permState(saved)
  useUi.getState().setBackup(state === 'granted' ? 'on' : 'needs-permission', saved.name)
}

export async function chooseBackupFile(): Promise<void> {
  const p = picker()
  if (!p) return
  const handle = await p({
    suggestedName: 'dj-secretary-backup.json',
    types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }],
  })
  currentHandle = handle
  await metaSet(HANDLE_KEY, handle)
  useUi.getState().setBackup('on', handle.name)
  await writeNow()
}

export async function resumeAutoBackup(): Promise<void> {
  if (!currentHandle) return
  try {
    const state = currentHandle.requestPermission
      ? await currentHandle.requestPermission({ mode: 'readwrite' })
      : 'granted'
    if (state === 'granted') await writeNow()
  } catch {
    /* user declined */
  }
}

export async function turnOffAutoBackup(): Promise<void> {
  currentHandle = null
  await metaDelete(HANDLE_KEY)
  useUi.getState().setBackup('off', null)
}

// Clears the "unsaved changes" reminder after a manual Export.
export function noteManualBackup(): void {
  useUi.getState().markBackedUp(Date.now())
}
