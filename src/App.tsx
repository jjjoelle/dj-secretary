import { useEffect, useState } from 'react'
import { useUi } from './store/ui'
import { seedIfEmpty } from './db/seed'
import {
  isSpotifyConfigured,
  isSpotifyConnected,
  spotifyHandleRedirect,
  spotifyLogin,
  spotifyLogout,
} from './lib/spotify'
import { exportData } from './lib/backup'
import { requestPersistentStorage } from './lib/storage'
import { autoSnapshot } from './lib/snapshots'
import { initAutoBackup, noteManualBackup } from './lib/autobackup'
import { Sidebar } from './components/Sidebar'
import { CollectionView } from './components/CollectionView'
import { TrackInspector } from './components/track/TrackInspector'
import { BackupModal } from './components/BackupModal'

const NUDGE_KEY = 'dj-secretary.storageNudgeDismissed'

function App() {
  const spotifyConnected = useUi((s) => s.spotifyConnected)
  const setSpotifyConnected = useUi((s) => s.setSpotifyConnected)
  const backupStatus = useUi((s) => s.backupStatus)
  const unsavedChanges = useUi((s) => s.unsavedChanges)
  const [backupOpen, setBackupOpen] = useState(false)
  const [showStorageNudge, setShowStorageNudge] = useState(false)

  useEffect(() => {
    void (async () => {
      await spotifyHandleRedirect()
      setSpotifyConnected(isSpotifyConnected())
      await seedIfEmpty()
      await autoSnapshot('startup')
      await initAutoBackup()
      const persisted = await requestPersistentStorage()
      if (!persisted && localStorage.getItem(NUDGE_KEY) !== '1') setShowStorageNudge(true)
    })()
  }, [setSpotifyConnected])

  const dismissNudge = () => {
    try {
      localStorage.setItem(NUDGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowStorageNudge(false)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-edge bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎧</span>
          <span className="font-semibold tracking-tight text-zinc-100">DJ Secretary</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isSpotifyConfigured() &&
            (spotifyConnected ? (
              <button
                className="rounded-md px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-panel2"
                title="Disconnect Spotify"
                onClick={() => {
                  spotifyLogout()
                  setSpotifyConnected(false)
                }}
              >
                Spotify ✓
              </button>
            ) : (
              <button
                className="rounded-md border border-edge bg-panel2 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-edge"
                onClick={() => void spotifyLogin()}
              >
                Connect Spotify
              </button>
            ))}

          {/* Backup status hint */}
          {backupStatus === 'on' && unsavedChanges === 0 ? (
            <span className="text-xs text-emerald-300/70">Backed up ✓</span>
          ) : backupStatus === 'needs-permission' ? (
            <button className="text-xs text-amber-300 hover:text-amber-100" onClick={() => setBackupOpen(true)}>
              Resume backup
            </button>
          ) : unsavedChanges > 0 && backupStatus !== 'on' ? (
            <button className="text-xs text-amber-400 hover:text-amber-200" onClick={() => setBackupOpen(true)}>
              ● {unsavedChanges} unsaved
            </button>
          ) : null}

          <button
            className="rounded-md border border-edge bg-panel2 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-edge"
            onClick={() => setBackupOpen(true)}
          >
            Backup
          </button>
        </div>
      </header>

      {showStorageNudge && (
        <div className="flex items-center gap-3 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
          <span>
            Your browser hasn't granted persistent storage, so it could evict your library. Set up auto-backup or keep an
            export — open <span className="font-medium">Backup</span>.
          </span>
          <button className="ml-auto rounded px-2 py-1 text-amber-100 hover:bg-amber-900/40" onClick={() => setBackupOpen(true)}>
            Open Backup
          </button>
          <button
            className="rounded px-2 py-1 text-amber-100 hover:bg-amber-900/40"
            onClick={() => {
              void exportData()
              noteManualBackup()
            }}
          >
            Export now
          </button>
          <button className="rounded px-2 py-1 text-amber-300/80 hover:text-amber-100" onClick={dismissNudge}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-h-0 flex-1">
          <CollectionView />
        </main>
      </div>

      <TrackInspector />
      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}

export default App
