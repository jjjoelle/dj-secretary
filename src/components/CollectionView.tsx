import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updatePlaylist, deletePlaylist, updateSet, deleteSet } from '../db/db'
import type { Track } from '../types'
import { useUi } from '../store/ui'
import type { ViewMode } from '../store/ui'
import { TrackTable } from './library/TrackTable'
import { TrackGrid } from './library/TrackGrid'
import { OrderedList } from './library/OrderedList'
import { LinearView } from './library/LinearView'
import { GraphView } from './graph/GraphView'
import { TransitionsList } from './TransitionsList'
import { SpotifyPage } from './spotify/SpotifyPage'
import { AddTrackModal } from './library/AddTrackModal'
import { btn, inputCls } from './common/widgets'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'list', label: 'List' },
  { mode: 'linear', label: 'Linear' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'graph', label: 'Graph' },
]

export function CollectionView() {
  const collection = useUi((s) => s.collection)
  const setCollection = useUi((s) => s.setCollection)
  const viewMode = useUi((s) => s.viewMode)
  const setViewMode = useUi((s) => s.setViewMode)
  const search = useUi((s) => s.search)
  const setSearch = useUi((s) => s.setSearch)
  const selectTrack = useUi((s) => s.selectTrack)
  const [adding, setAdding] = useState(false)

  // Per-view tag filter (AND semantics). Resets when you switch collections.
  const [tagFilter, setTagFilter] = useState<string[]>([])
  useEffect(() => setTagFilter([]), [collection])

  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const annotations = useLiveQuery(() => db.annotations.toArray(), [])
  const edges = useLiveQuery(() => db.edges.toArray(), [])
  const playlistId = collection.kind === 'playlist' ? collection.id : ''
  const playlist = useLiveQuery(() => db.playlists.get(playlistId), [playlistId])
  const setId = collection.kind === 'set' ? collection.id : ''
  const trackSet = useLiveQuery(() => db.sets.get(setId), [setId])

  const trackById = useMemo(() => new Map((tracks ?? []).map((t) => [t.id, t])), [tracks])
  const annCount = useMemo(() => {
    const m = new Map<string, number>()
    annotations?.forEach((a) => m.set(a.trackId, (m.get(a.trackId) ?? 0) + 1))
    return m
  }, [annotations])
  const edgeCount = useMemo(() => {
    const m = new Map<string, number>()
    edges?.forEach((e) => {
      m.set(e.fromTrackId, (m.get(e.fromTrackId) ?? 0) + 1)
      m.set(e.toTrackId, (m.get(e.toTrackId) ?? 0) + 1)
    })
    return m
  }, [edges])

  const ordered = collection.kind === 'playlist' || collection.kind === 'set'
  const isSet = collection.kind === 'set'
  const record = collection.kind === 'playlist' ? playlist : collection.kind === 'set' ? trackSet : undefined

  // Resolve the collection → title + tracks (ordered for playlist/set).
  let title = 'All Tracks'
  let listTracks: Track[] = tracks ?? []
  let orderedIds: string[] = []
  if (collection.kind === 'artist') {
    title = collection.value
    listTracks = (tracks ?? []).filter((t) => t.artist === collection.value)
  } else if (collection.kind === 'genre') {
    title = collection.value
    listTracks = (tracks ?? []).filter((t) => t.genre === collection.value)
  } else if (collection.kind === 'tag') {
    title = `#${collection.value}`
    listTracks = (tracks ?? []).filter((t) => t.tags.includes(collection.value))
  } else if (ordered && record) {
    title = record.name
    orderedIds = record.trackIds
    listTracks = record.trackIds.map((id) => trackById.get(id)).filter((t): t is Track => !!t)
  }

  const availableTags = useMemo(
    () => [...new Set(listTracks.flatMap((t) => t.tags))].sort(),
    [listTracks],
  )
  const filterActive = tagFilter.length > 0
  const matchesTags = (t: Track) => tagFilter.every((tag) => t.tags.includes(tag))
  const tagged = filterActive ? listTracks.filter(matchesTags) : listTracks

  const q = search.trim().toLowerCase()
  const matchesSearch = (t: Track) =>
    !q ||
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    (t.genre ?? '').toLowerCase().includes(q) ||
    t.tags.some((tag) => tag.toLowerCase().includes(q))

  // List/Grid display: search applies only to unordered collections.
  const displayTracks = ordered ? tagged : tagged.filter(matchesSearch)
  const orderedListIds = filterActive ? tagged.map((t) => t.id) : orderedIds
  // Graph scope = the collection narrowed by the tag filter (not search).
  const scopeIds = collection.kind === 'all' && !filterActive ? undefined : tagged.map((t) => t.id)

  const availableForAdd = useMemo(
    () =>
      (tracks ?? [])
        .filter((t) => !orderedIds.includes(t.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [tracks, orderedIds],
  )

  const saveOrder = (ids: string[]) => {
    if (collection.kind === 'playlist') void updatePlaylist(collection.id, { trackIds: ids })
    else if (collection.kind === 'set') void updateSet(collection.id, { trackIds: ids })
  }
  const rename = (name: string) => {
    if (collection.kind === 'playlist') void updatePlaylist(collection.id, { name })
    else if (collection.kind === 'set') void updateSet(collection.id, { name })
  }
  const removeCollection = () => {
    if (!record) return
    if (!confirm(`Delete ${isSet ? 'set' : 'playlist'} "${record.name}"?`)) return
    if (collection.kind === 'playlist') void deletePlaylist(collection.id)
    else if (collection.kind === 'set') void deleteSet(collection.id)
    setCollection({ kind: 'all' })
  }

  const missingRecord = ordered && !record

  // The Transitions view and My Spotify page are their own things (not track collections).
  if (collection.kind === 'transitions') return <TransitionsList />
  if (collection.kind === 'spotify') return <SpotifyPage />

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        {ordered ? (
          <input
            className={`${inputCls} max-w-xs text-base font-semibold`}
            value={record?.name ?? ''}
            onChange={(e) => rename(e.target.value)}
          />
        ) : (
          <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
        )}
        <span className="text-xs text-zinc-500">
          {filterActive ? `${displayTracks.length} of ` : ''}
          {ordered ? orderedIds.length : listTracks.length} tracks
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!ordered && (
            <input
              className={`${inputCls} max-w-[12rem]`}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="flex rounded-md border border-edge bg-ink p-0.5">
            {VIEW_MODES.map((v) => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  viewMode === v.mode ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {ordered && (
            <button className={btn.ghost} onClick={removeCollection}>
              Delete
            </button>
          )}
          <button className={btn.primary} onClick={() => setAdding(true)}>
            + Add track
          </button>
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-4 py-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Filter</span>
          {availableTags.map((tag) => {
            const on = tagFilter.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(on ? tagFilter.filter((x) => x !== tag) : [...tagFilter, tag])}
                className={`rounded-full px-2 py-0.5 text-xs transition ${
                  on ? 'bg-accent text-white' : 'bg-panel2 text-zinc-300 hover:bg-edge'
                }`}
              >
                #{tag}
              </button>
            )
          })}
          {filterActive && (
            <button onClick={() => setTagFilter([])} className="ml-1 text-xs text-zinc-500 hover:text-zinc-200">
              clear
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {missingRecord ? (
          <div className="p-8 text-sm text-zinc-500">This collection no longer exists.</div>
        ) : viewMode === 'graph' ? (
          <div className="h-full">
            <GraphView trackIds={scopeIds} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            {viewMode === 'list' &&
              (ordered ? (
                <OrderedList
                  trackIds={orderedListIds}
                  trackById={trackById}
                  edges={edges ?? []}
                  isSet={isSet}
                  availableTracks={availableForAdd}
                  onChange={saveOrder}
                  onRowClick={selectTrack}
                  readOnly={filterActive}
                />
              ) : displayTracks.length === 0 ? (
                <EmptyMessage />
              ) : (
                <TrackTable tracks={displayTracks} annCount={annCount} edgeCount={edgeCount} onRowClick={selectTrack} />
              ))}
            {viewMode === 'grid' &&
              (displayTracks.length === 0 ? (
                <EmptyMessage />
              ) : (
                <TrackGrid tracks={displayTracks} annCount={annCount} edgeCount={edgeCount} onCardClick={selectTrack} />
              ))}
            {viewMode === 'linear' && (
              <LinearView tracks={displayTracks} edges={edges ?? []} onRowClick={selectTrack} />
            )}
          </div>
        )}
      </div>

      <AddTrackModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function EmptyMessage() {
  return <div className="mt-16 text-center text-sm text-zinc-500">No tracks here yet.</div>
}
