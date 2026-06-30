import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal, TagInput, btn, inputCls, labelCls } from '../common/widgets'
import { CAMELOT_KEYS } from '../../lib/music'
import { formatTime, parseTime } from '../../lib/time'
import { db, createTrack } from '../../db/db'
import { useUi } from '../../store/ui'
import {
  isSpotifyConfigured,
  searchTracks,
  spotifyLogin,
  type SpotifyTrackResult,
} from '../../lib/spotify'

type Tab = 'search' | 'manual'

export function AddTrackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const configured = isSpotifyConfigured()
  const [tab, setTab] = useState<Tab>('search')

  useEffect(() => {
    if (open) setTab(configured ? 'search' : 'manual')
  }, [open, configured])

  return (
    <Modal open={open} onClose={onClose} title="Add track" maxW="max-w-2xl">
      {configured && (
        <div className="mb-4 flex rounded-md border border-edge bg-ink p-0.5 text-sm">
          <button
            className={`flex-1 rounded px-3 py-1.5 transition ${tab === 'search' ? 'bg-accent text-white' : 'text-zinc-300 hover:text-white'}`}
            onClick={() => setTab('search')}
          >
            Search Spotify
          </button>
          <button
            className={`flex-1 rounded px-3 py-1.5 transition ${tab === 'manual' ? 'bg-accent text-white' : 'text-zinc-300 hover:text-white'}`}
            onClick={() => setTab('manual')}
          >
            Add manually
          </button>
        </div>
      )}

      {configured && tab === 'search' ? (
        <SpotifySearchPanel onClose={onClose} />
      ) : (
        <ManualForm onClose={onClose} />
      )}
    </Modal>
  )
}

function SpotifySearchPanel({ onClose }: { onClose: () => void }) {
  const connected = useUi((s) => s.spotifyConnected)
  const libraryTracks = useLiveQuery(() => db.tracks.toArray(), [])
  const existingIds = useMemo(
    () => new Set((libraryTracks ?? []).map((t) => t.spotifyId).filter(Boolean) as string[]),
    [libraryTracks],
  )

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrackResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const seq = useRef(0)

  useEffect(() => {
    if (!connected) return
    const q = query.trim()
    if (q === '') {
      setResults([])
      return
    }
    const mySeq = ++seq.current
    setLoading(true)
    setError(null)
    const handle = setTimeout(async () => {
      try {
        const res = await searchTracks(q)
        if (mySeq === seq.current) setResults(res)
      } catch (e) {
        if (mySeq === seq.current) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (mySeq === seq.current) setLoading(false)
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [query, connected])

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-zinc-400">Connect Spotify to search and add tracks with album art.</p>
        <button className={btn.primary} onClick={() => void spotifyLogin()}>
          Connect Spotify
        </button>
      </div>
    )
  }

  const add = async (r: SpotifyTrackResult) => {
    await createTrack({
      title: r.title,
      artist: r.artist,
      durationSec: r.durationSec,
      spotifyId: r.spotifyId,
      albumArtUrl: r.albumArtUrl,
      tags: [],
    })
    setAdded((s) => new Set(s).add(r.spotifyId))
  }

  return (
    <div className="flex flex-col">
      <input
        className={inputCls}
        placeholder="Search Spotify by title or artist…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="mt-1 h-4 text-xs">
        {loading && <span className="text-zinc-500">Searching…</span>}
        {error && <span className="text-rose-400">{error}</span>}
      </div>

      <ul className="mt-1 max-h-[48vh] min-h-[8rem] divide-y divide-edge overflow-y-auto rounded-md border border-edge">
        {results.length === 0 && !loading && (
          <li className="px-3 py-8 text-center text-sm text-zinc-500">
            {query.trim() ? 'No results.' : 'Start typing to search Spotify.'}
          </li>
        )}
        {results.map((r) => {
          const isAdded = added.has(r.spotifyId) || existingIds.has(r.spotifyId)
          return (
            <li key={r.spotifyId} className="flex items-center gap-3 px-3 py-2">
              {r.albumArtUrl ? (
                <img src={r.albumArtUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-panel2 text-zinc-600">♪</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-100">{r.title}</div>
                <div className="truncate text-xs text-zinc-400">{r.artist}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {[r.album, r.year].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatTime(r.durationSec)}</span>
              <button
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isAdded
                    ? 'cursor-default text-emerald-400'
                    : 'bg-accent text-white hover:bg-accent2'
                }`}
                disabled={isAdded}
                onClick={() => void add(r)}
              >
                {isAdded ? '✓ Added' : 'Add'}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Add as many as you like, then close.</span>
        <button className={btn.primary} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

interface FormState {
  title: string
  artist: string
  durationText: string
  bpm: string
  key: string
  genre: string
  energy: string
  tags: string[]
  notes: string
}

const EMPTY: FormState = {
  title: '',
  artist: '',
  durationText: '',
  bpm: '',
  key: '',
  genre: '',
  energy: '',
  tags: [],
  notes: '',
}

function ManualForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const selectTrack = useUi((s) => s.selectTrack)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const canSave = form.title.trim() !== '' && form.artist.trim() !== ''

  const save = async () => {
    if (!canSave) return
    const id = await createTrack({
      title: form.title.trim(),
      artist: form.artist.trim(),
      durationSec: parseTime(form.durationText) ?? undefined,
      bpm: form.bpm.trim() === '' ? undefined : Number(form.bpm),
      key: form.key || undefined,
      genre: form.genre.trim() || undefined,
      energy: form.energy === '' ? undefined : Number(form.energy),
      tags: form.tags,
      notes: form.notes.trim() || undefined,
    })
    onClose()
    selectTrack(id)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Title *</label>
          <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Artist *</label>
          <input className={inputCls} value={form.artist} onChange={(e) => set('artist', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Duration (m:ss)</label>
          <input className={inputCls} placeholder="3:45" value={form.durationText} onChange={(e) => set('durationText', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>BPM</label>
          <input className={inputCls} type="number" placeholder="128" value={form.bpm} onChange={(e) => set('bpm', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Key</label>
          <select className={inputCls} value={form.key} onChange={(e) => set('key', e.target.value)}>
            <option value="">—</option>
            {CAMELOT_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Energy (1–10)</label>
          <input className={inputCls} type="number" min={1} max={10} placeholder="6" value={form.energy} onChange={(e) => set('energy', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Genre</label>
          <input className={inputCls} value={form.genre} onChange={(e) => set('genre', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Tags</label>
          <TagInput value={form.tags} onChange={(t) => set('tags', t)} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button className={btn.ghost} onClick={onClose}>
          Cancel
        </button>
        <button className={btn.primary} onClick={save} disabled={!canSave}>
          Add to library
        </button>
      </div>
    </div>
  )
}
