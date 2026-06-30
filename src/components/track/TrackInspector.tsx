import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateTrack, deleteTrack, updatePlaylist, updateSet } from '../../db/db'
import type { Track, Playlist, TrackSet } from '../../types'
import { useUi } from '../../store/ui'
import { CAMELOT_KEYS } from '../../lib/music'
import { formatTime, parseTime } from '../../lib/time'
import { TagInput, inputCls, labelCls, btn } from '../common/widgets'
import { AnnotationTimeline } from './AnnotationTimeline'
import { TransitionsPanel } from './TransitionsPanel'

export function TrackInspector() {
  const selectedTrackId = useUi((s) => s.selectedTrackId)
  const selectTrack = useUi((s) => s.selectTrack)

  const track = useLiveQuery(() => db.tracks.get(selectedTrackId ?? ''), [selectedTrackId])
  const annotations = useLiveQuery(
    () => db.annotations.where('trackId').equals(selectedTrackId ?? '').toArray(),
    [selectedTrackId],
  )
  const allTracks = useLiveQuery(() => db.tracks.toArray(), [])
  const edges = useLiveQuery(() => db.edges.toArray(), [])
  const playlists = useLiveQuery(() => db.playlists.toArray(), [])
  const sets = useLiveQuery(() => db.sets.toArray(), [])

  if (!selectedTrackId) return null

  const outgoing = (edges ?? []).filter((e) => e.fromTrackId === selectedTrackId)
  const incoming = (edges ?? []).filter((e) => e.toTrackId === selectedTrackId)

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[440px] flex-col border-l border-edge bg-panel shadow-2xl">
      {!track ? (
        <div className="p-6 text-sm text-zinc-500">Track not found.</div>
      ) : (
        <>
          <header className="flex items-start gap-3 border-b border-edge p-4">
            {track.albumArtUrl ? (
              <img src={track.albumArtUrl} alt="" className="h-14 w-14 rounded object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded bg-panel2 text-2xl text-zinc-700">
                ♪
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-zinc-100">{track.title}</h2>
              <p className="truncate text-sm text-zinc-400">{track.artist}</p>
            </div>
            <button
              onClick={() => selectTrack(null)}
              className="rounded p-1 text-zinc-400 hover:bg-edge hover:text-zinc-100"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <AddToCollections trackId={track.id} playlists={playlists ?? []} sets={sets ?? []} />
            <DetailsForm key={track.id} track={track} />
            <AnnotationTimeline
              trackId={track.id}
              durationSec={track.durationSec}
              annotations={annotations ?? []}
            />
            <TransitionsPanel
              track={track}
              allTracks={allTracks ?? []}
              outgoing={outgoing}
              incoming={incoming}
            />
            <div className="pt-2">
              <button
                className={btn.danger}
                onClick={() => {
                  if (confirm(`Delete "${track.title}"? This also removes its annotations and transitions.`)) {
                    void deleteTrack(track.id)
                    selectTrack(null)
                  }
                }}
              >
                Delete track
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

function AddToCollections({
  trackId,
  playlists,
  sets,
}: {
  trackId: string
  playlists: Playlist[]
  sets: TrackSet[]
}) {
  if (playlists.length === 0 && sets.length === 0) return null
  return (
    <div>
      <label className={labelCls}>Add to</label>
      <select
        className={inputCls}
        value=""
        onChange={(e) => {
          const v = e.target.value
          e.currentTarget.value = ''
          if (!v) return
          const [kind, id] = v.split(':')
          if (kind === 'playlist') {
            const p = playlists.find((x) => x.id === id)
            if (p && !p.trackIds.includes(trackId)) void updatePlaylist(id, { trackIds: [...p.trackIds, trackId] })
          } else {
            const s = sets.find((x) => x.id === id)
            if (s && !s.trackIds.includes(trackId)) void updateSet(id, { trackIds: [...s.trackIds, trackId] })
          }
        }}
      >
        <option value="">Add to playlist or set…</option>
        {playlists.length > 0 && (
          <optgroup label="Playlists">
            {playlists.map((p) => (
              <option key={p.id} value={`playlist:${p.id}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {sets.length > 0 && (
          <optgroup label="Sets">
            {sets.map((s) => (
              <option key={s.id} value={`set:${s.id}`}>
                {s.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}

function DetailsForm({ track }: { track: Track }) {
  const id = track.id
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist)
  const [durationText, setDurationText] = useState(track.durationSec != null ? formatTime(track.durationSec) : '')
  const [bpm, setBpm] = useState(track.bpm != null ? String(track.bpm) : '')
  const [genre, setGenre] = useState(track.genre ?? '')
  const [energy, setEnergy] = useState(track.energy != null ? String(track.energy) : '')

  return (
    <section className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={labelCls}>Title</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim()
            if (t) void updateTrack(id, { title: t })
            else setTitle(track.title)
          }}
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Artist</label>
        <input
          className={inputCls}
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onBlur={() => {
            const t = artist.trim()
            if (t) void updateTrack(id, { artist: t })
            else setArtist(track.artist)
          }}
        />
      </div>
      <div>
        <label className={labelCls}>Duration</label>
        <input
          className={inputCls}
          value={durationText}
          placeholder="m:ss"
          onChange={(e) => setDurationText(e.target.value)}
          onBlur={() => {
            const secs = parseTime(durationText)
            void updateTrack(id, { durationSec: secs ?? undefined })
            setDurationText(secs != null ? formatTime(secs) : '')
          }}
        />
      </div>
      <div>
        <label className={labelCls}>BPM</label>
        <input
          className={inputCls}
          type="number"
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          onBlur={() => void updateTrack(id, { bpm: bpm.trim() === '' ? undefined : Number(bpm) })}
        />
      </div>
      <div>
        <label className={labelCls}>Key</label>
        <select
          className={inputCls}
          value={track.key ?? ''}
          onChange={(e) => void updateTrack(id, { key: e.target.value || undefined })}
        >
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
        <input
          className={inputCls}
          type="number"
          min={1}
          max={10}
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          onBlur={() => void updateTrack(id, { energy: energy.trim() === '' ? undefined : Number(energy) })}
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Genre</label>
        <input
          className={inputCls}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          onBlur={() => void updateTrack(id, { genre: genre.trim() || undefined })}
        />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Tags</label>
        <TagInput value={track.tags} onChange={(tags) => void updateTrack(id, { tags })} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>Notes</label>
        <textarea
          className={`${inputCls} min-h-[60px] resize-y`}
          defaultValue={track.notes ?? ''}
          onBlur={(e) => void updateTrack(id, { notes: e.target.value.trim() || undefined })}
        />
      </div>
    </section>
  )
}
