import { useEffect, useRef, useState } from 'react'
import { useUi } from './store/ui'
import { seedIfEmpty } from './db/seed'
import {
  isSpotifyConfigured,
  isSpotifyConnected,
  spotifyHandleRedirect,
  spotifyLogin,
  spotifyLogout,
} from './lib/spotify'
import { exportData, importData } from './lib/backup'
import { requestPersistentStorage } from './lib/storage'
import { autoSnapshot, takeSnapshot } from './lib/snapshots'
import { Sidebar } from './components/Sidebar'
import { CollectionView } from './components/CollectionView'
import { TrackInspector } from './components/track/TrackInspector'
import { SnapshotsModal } from './components/SnapshotsModal'

const NUDGE_KEY = 'dj-secretary.storageNudgeDismissed'

function App() {
  const spotifyConnected = useUi((s) => s.spotifyConnected)
  const setSpotifyConnected = useUi((s) => s.setSpotifyConnected)
  const fileInput = useRef<HTMLInputElement>(null)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [showStorageNudge, setShowStorageNudge] = useState(false)

  useEffect(() => {
    void (async () => {
      await spotifyHandleRedirect()
      setSpotifyConnected(isSpotifyConnected())
      await seedIfEmpty()
      // Recovery point for this session, then ask the browser not to evict us.
      await autoSnapshot('startup')
      const persisted = await requestPersistentStorage()
      if (!persisted && localStorage.getItem(NUDGE_KEY) !== '1') {
        setShowStorageNudge(true)
      }
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

  const onImport = async (file: File) => {
    if (!confirm('Importing replaces your entire current library. Continue?')) return
    try {
      await takeSnapshot('before import') // so an import is undoable from Snapshots
      await importData(file)
      alert('Backup imported.')
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
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
          <button
            className="rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-panel2"
            onClick={() => setSnapshotsOpen(true)}
          >
            Snapshots
          </button>
          <button
            className="rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-panel2"
            onClick={() => void exportData()}
          >
            Export
          </button>
          <button
            className="rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-panel2"
            onClick={() => fileInput.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {showStorageNudge && (
        <div className="flex items-center gap-3 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
          <span>
            Your browser hasn't granted persistent storage, so it could evict your library under disk
            pressure. Keep a backup with <span className="font-medium">Export</span> (or install the app).
          </span>
          <button className="ml-auto rounded px-2 py-1 text-amber-100 hover:bg-amber-900/40" onClick={() => void exportData()}>
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
      <SnapshotsModal open={snapshotsOpen} onClose={() => setSnapshotsOpen(false)} />
    </div>
  )
}

export default App
