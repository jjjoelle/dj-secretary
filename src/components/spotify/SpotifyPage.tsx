import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useUi } from '../../store/ui'
import { formatTime } from '../../lib/time'
import { Modal, btn } from '../common/widgets'
import {
  getMe,
  getCurrentlyPlaying,
  getRecentlyPlayed,
  getMyPlaylists,
  getPlaylistTracks,
  hasSpotifyScopes,
  spotifyLogin,
  spotifyLogout,
  type SpotifyProfile,
  type NowPlaying,
  type RecentlyPlayedItem,
  type SpotifyPlaylistSummary,
  type SpotifyTrackResult,
} from '../../lib/spotify'
import { importSpotifyTrack, importSpotifyPlaylist } from '../../lib/spotifyImport'

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function SpotifyPage() {
  const connected = useUi((s) => s.spotifyConnected)
  const setSpotifyConnected = useUi((s) => s.setSpotifyConnected)
  const setCollection = useUi((s) => s.setCollection)
  const scopesOk = useMemo(() => hasSpotifyScopes(), [])

  const libTracks = useLiveQuery(() => db.tracks.toArray(), [])
  const inLibrary = useMemo(
    () => new Set((libTracks ?? []).map((t) => t.spotifyId).filter(Boolean) as string[]),
    [libTracks],
  )

  const [profile, setProfile] = useState<SpotifyProfile | null>(null)
  const [now, setNow] = useState<NowPlaying | null>(null)
  const [recent, setRecent] = useState<RecentlyPlayedItem[]>([])
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylistSummary | null>(null)

  const ready = connected && scopesOk

  // Load the static sections once.
  useEffect(() => {
    if (!ready) return
    let live = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [p, r, pls, np] = await Promise.all([
          getMe(),
          getRecentlyPlayed(20),
          getMyPlaylists(50),
          getCurrentlyPlaying(),
        ])
        if (!live) return
        setProfile(p)
        setRecent(r)
        setPlaylists(pls)
        setNow(np)
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Failed to load Spotify data')
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [ready])

  // Poll now-playing while the page is visible.
  const refreshNow = useRef(() => {})
  refreshNow.current = () => {
    if (!ready || document.hidden) return
    void getCurrentlyPlaying()
      .then(setNow)
      .catch(() => {})
  }
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => refreshNow.current(), 20000)
    return () => clearInterval(id)
  }, [ready])

  const disconnect = () => {
    spotifyLogout()
    setSpotifyConnected(false)
    setCollection({ kind: 'all' })
  }

  if (!connected) {
    return (
      <Centered>
        <p className="text-sm text-zinc-400">Connect Spotify to see your now-playing, recent tracks, and playlists.</p>
        <button className={btn.primary} onClick={() => void spotifyLogin()}>
          Connect Spotify
        </button>
      </Centered>
    )
  }
  if (!scopesOk) {
    return (
      <Centered>
        <p className="max-w-sm text-center text-sm text-zinc-400">
          The My Spotify page needs a few read permissions (now-playing, recently-played, your playlists). Reconnect once
          to grant them.
        </p>
        <button className={btn.primary} onClick={() => void spotifyLogin()}>
          Reconnect to enable
        </button>
      </Centered>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-panel2" />
        )}
        <div>
          <h1 className="text-base font-semibold text-zinc-100">My Spotify</h1>
          {profile && <p className="text-xs text-zinc-500">{profile.displayName}</p>}
        </div>
        <button className="ml-auto text-xs text-zinc-400 hover:text-zinc-100" onClick={disconnect}>
          Disconnect
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {error && <div className="rounded-md border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        {/* Now playing */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Now playing</h2>
            <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => refreshNow.current()}>
              Refresh
            </button>
          </div>
          {now ? (
            <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel2 p-3">
              {now.track.albumArtUrl ? (
                <img src={now.track.albumArtUrl} alt="" className="h-14 w-14 rounded object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded bg-panel text-zinc-600">♪</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-100">{now.track.title}</div>
                <div className="truncate text-xs text-zinc-400">{now.track.artist}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {now.isPlaying ? '▶' : '❚❚'} {formatTime(now.progressSec)} / {formatTime(now.track.durationSec)}
                </div>
              </div>
              <AddButton spotifyId={now.track.spotifyId} inLibrary={inLibrary} onAdd={() => importSpotifyTrack(now.track)} />
            </div>
          ) : (
            <p className="rounded-lg border border-edge bg-panel2 px-3 py-4 text-sm text-zinc-500">
              {loading ? 'Loading…' : 'Nothing playing right now.'}
            </p>
          )}
        </section>

        {/* Recently played */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Recently played</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">{loading ? 'Loading…' : 'Nothing recent.'}</p>
          ) : (
            <ul className="divide-y divide-edge rounded-md border border-edge">
              {recent.map((it, i) => (
                <li key={`${it.track.spotifyId}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <TrackThumb url={it.track.albumArtUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-100">{it.track.title}</div>
                    <div className="truncate text-xs text-zinc-400">{it.track.artist}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-zinc-500">{ago(it.playedAt)}</span>
                  <AddButton spotifyId={it.track.spotifyId} inLibrary={inLibrary} onAdd={() => importSpotifyTrack(it.track)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Your playlists */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your playlists</h2>
          {playlists.length === 0 ? (
            <p className="text-sm text-zinc-500">{loading ? 'Loading…' : 'No playlists.'}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setOpenPlaylist(p)}
                  className="flex flex-col overflow-hidden rounded-lg border border-edge bg-panel text-left transition hover:border-accent/60 hover:bg-panel2"
                >
                  <div className="aspect-square w-full bg-panel2">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-700">♪</div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-sm text-zinc-100">{p.name}</div>
                    <div className="truncate text-[11px] text-zinc-500">{p.trackCount} tracks</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {openPlaylist && (
        <PlaylistImportModal playlist={openPlaylist} inLibrary={inLibrary} onClose={() => setOpenPlaylist(null)} />
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-8">{children}</div>
}

function TrackThumb({ url }: { url?: string }) {
  return url ? (
    <img src={url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-panel2 text-zinc-600">♪</div>
  )
}

function AddButton({
  spotifyId,
  inLibrary,
  onAdd,
}: {
  spotifyId: string
  inLibrary: Set<string>
  onAdd: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  const added = inLibrary.has(spotifyId)
  if (added) return <span className="shrink-0 text-xs text-emerald-400">✓ In library</span>
  return (
    <button
      className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-accent2 disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await onAdd()
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? '…' : 'Add'}
    </button>
  )
}

function PlaylistImportModal({
  playlist,
  inLibrary,
  onClose,
}: {
  playlist: SpotifyPlaylistSummary
  inLibrary: Set<string>
  onClose: () => void
}) {
  const [tracks, setTracks] = useState<SpotifyTrackResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let live = true
    void getPlaylistTracks(playlist.id)
      .then((t) => live && setTracks(t))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load tracks'))
    return () => {
      live = false
    }
  }, [playlist.id])

  const importAll = async (as: 'playlist' | 'set') => {
    if (!tracks) return
    setImporting(true)
    try {
      const { added, total } = await importSpotifyPlaylist(playlist.name, tracks, as)
      alert(`Imported ${total} tracks (${added} new) as a ${as}.`)
      onClose()
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={playlist.name} maxW="max-w-xl">
      <div className="mb-3 flex gap-2">
        <button className={btn.primary} disabled={!tracks || importing} onClick={() => void importAll('playlist')}>
          Import as playlist
        </button>
        <button className={btn.ghost} disabled={!tracks || importing} onClick={() => void importAll('set')}>
          Import as set
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <ul className="max-h-[50vh] divide-y divide-edge overflow-y-auto rounded-md border border-edge">
        {!tracks && !error && <li className="px-3 py-8 text-center text-sm text-zinc-500">Loading tracks…</li>}
        {tracks?.map((t, i) => (
          <li key={`${t.spotifyId}-${i}`} className="flex items-center gap-3 px-3 py-2">
            <TrackThumb url={t.albumArtUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-zinc-100">{t.title}</div>
              <div className="truncate text-xs text-zinc-400">{t.artist}</div>
            </div>
            <AddButton spotifyId={t.spotifyId} inLibrary={inLibrary} onAdd={() => importSpotifyTrack(t)} />
          </li>
        ))}
      </ul>
    </Modal>
  )
}
