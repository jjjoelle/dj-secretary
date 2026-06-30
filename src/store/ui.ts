import { create } from 'zustand'

export type ViewMode = 'list' | 'grid' | 'graph'

// What the main area is currently showing.
export type Collection =
  | { kind: 'all' }
  | { kind: 'artist'; value: string }
  | { kind: 'genre'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'playlist'; id: string }
  | { kind: 'set'; id: string }
  | { kind: 'transitions' }

const VIEW_MODE_KEY = 'dj-secretary.viewMode'

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY)
    if (v === 'list' || v === 'grid' || v === 'graph') return v
  } catch {
    /* ignore */
  }
  return 'list'
}

// Auto-backup-to-file state. 'unsupported' = browser has no File System Access API.
export type BackupStatus = 'unsupported' | 'off' | 'on' | 'needs-permission'

interface UiState {
  collection: Collection
  viewMode: ViewMode
  selectedTrackId: string | null // track open in the inspector
  focusTrackId: string | null // centered node in graph focus mode
  search: string
  spotifyConnected: boolean

  backupStatus: BackupStatus
  backupFileName: string | null
  unsavedChanges: number // changes since the last successful backup/export
  lastBackupAt: number | null

  setCollection: (c: Collection) => void
  setViewMode: (m: ViewMode) => void
  selectTrack: (id: string | null) => void
  setFocusTrack: (id: string | null) => void
  setSearch: (q: string) => void
  setSpotifyConnected: (connected: boolean) => void
  setBackup: (status: BackupStatus, fileName?: string | null) => void
  bumpUnsaved: () => void
  markBackedUp: (at: number) => void
}

export const useUi = create<UiState>((set) => ({
  collection: { kind: 'all' },
  viewMode: loadViewMode(),
  selectedTrackId: null,
  focusTrackId: null,
  search: '',
  spotifyConnected: false,

  backupStatus: 'off',
  backupFileName: null,
  unsavedChanges: 0,
  lastBackupAt: null,

  setCollection: (collection) => set({ collection }),
  setViewMode: (viewMode) => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode)
    } catch {
      /* ignore */
    }
    set({ viewMode })
  },
  selectTrack: (id) => set({ selectedTrackId: id }),
  setFocusTrack: (id) => set({ focusTrackId: id }),
  setSearch: (q) => set({ search: q }),
  setSpotifyConnected: (connected) => set({ spotifyConnected: connected }),
  setBackup: (backupStatus, fileName) =>
    set(fileName === undefined ? { backupStatus } : { backupStatus, backupFileName: fileName }),
  bumpUnsaved: () => set((s) => ({ unsavedChanges: s.unsavedChanges + 1 })),
  markBackedUp: (at) => set({ unsavedChanges: 0, lastBackupAt: at }),
}))
