import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  updatePlaylist,
  deletePlaylist,
  updateSet,
  deleteSet,
  metaGet,
  metaSet,
  createSmartCrate,
  updateSmartCrate,
  deleteSmartCrate,
} from '../db/db'
import type { Track, FilterQuery, ColumnConfig } from '../types'
import { useUi } from '../store/ui'
import type { ViewMode, Collection } from '../store/ui'
import { emptyQuery, isQueryActive, filterTracks, canonicalQuery } from '../lib/filter'
import { TrackTable } from './library/TrackTable'
import { TrackGrid } from './library/TrackGrid'
import { OrderedList } from './library/OrderedList'
import { FilterBar } from './library/FilterBar'
import { ColumnsMenu } from './library/ColumnsMenu'
import { LinearView } from './library/LinearView'
import { GraphView } from './graph/GraphView'
import { TransitionsList } from './TransitionsList'
import { SpotifyPage } from './spotify/SpotifyPage'
import { AddTrackModal } from './library/AddTrackModal'
import { btn, inputCls, Modal } from './common/widgets'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'list', label: 'List' },
  { mode: 'linear', label: 'Linear' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'graph', label: 'Graph' },
]

// A stable identity for a collection — used to re-seed the filter only when the
// *target* changes, not when unrelated live-query data refreshes.
function collectionSig(c: Collection): string {
  if (c.kind === 'crate' || c.kind === 'playlist' || c.kind === 'set') return `${c.kind}:${c.id}`
  if (c.kind === 'artist' || c.kind === 'genre' || c.kind === 'tag') return `${c.kind}:${c.value}`
  return c.kind
}

const slotPrimary = 'rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white transition hover:bg-accent2'
const slotGhost = 'rounded-md border border-edge bg-panel2 px-2 py-0.5 text-xs text-zinc-200 transition hover:bg-edge'

export function CollectionView() {
  const collection = useUi((s) => s.collection)
  const setCollection = useUi((s) => s.setCollection)
  const viewMode = useUi((s) => s.viewMode)
  const setViewMode = useUi((s) => s.setViewMode)
  const search = useUi((s) => s.search)
  const setSearch = useUi((s) => s.setSearch)
  const selectTrack = useUi((s) => s.selectTrack)
  const [adding, setAdding] = useState(false)
  const crates = useLiveQuery(() => db.smartCrates.toArray(), [])

  // Per-view structured filter. Resets when you switch collections; a smart
  // crate seeds it from its saved query. We re-seed only when the target
  // collection changes (not when `crates` refreshes), so live edits aren't lost.
  const [query, setQuery] = useState<FilterQuery>(emptyQuery())
  const seededFor = useRef<string>('')
  useEffect(() => {
    const sig = collectionSig(collection)
    if (seededFor.current === sig) return
    if (collection.kind === 'crate') {
      const crate = crates?.find((c) => c.id === collection.id)
      if (!crate) return // crates not loaded yet — re-run when they arrive
      setQuery(crate.query)
    } else {
      setQuery(emptyQuery())
    }
    seededFor.current = sig
  }, [collection, crates])

  const openCrate = collection.kind === 'crate' ? crates?.find((c) => c.id === collection.id) : undefined

  // Save-as-crate naming modal.
  const [savingCrate, setSavingCrate] = useState(false)
  const [crateName, setCrateName] = useState('')

  // Device-local track-table column layout (persisted in `meta`, not exported).
  const [columnConfig, setColumnConfig] = useState<ColumnConfig | undefined>(undefined)
  const [columnsOpen, setColumnsOpen] = useState(false)
  useEffect(() => {
    void metaGet<ColumnConfig>('ui.trackColumns').then((c) => {
      if (c) setColumnConfig(c)
    })
  }, [])
  const updateColumns = (c: ColumnConfig) => {
    setColumnConfig(c)
    void metaSet('ui.trackColumns', c)
  }

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
  } else if (collection.kind === 'crate') {
    title = openCrate?.name ?? 'Smart crate'
    listTracks = tracks ?? [] // filtered below by the seeded query
  } else if (ordered && record) {
    title = record.name
    orderedIds = record.trackIds
    listTracks = record.trackIds.map((id) => trackById.get(id)).filter((t): t is Track => !!t)
  }

  const filterActive = isQueryActive(query)
  const tagged = filterTracks(listTracks, query)

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
  // Graph scope = the collection narrowed by the filter (not search).
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
    else if (collection.kind === 'crate') void updateSmartCrate(collection.id, { name })
  }
  const removeCollection = () => {
    if (collection.kind === 'crate') {
      if (!confirm(`Delete smart crate "${openCrate?.name ?? ''}"?`)) return
      void deleteSmartCrate(collection.id)
      setCollection({ kind: 'all' })
      return
    }
    if (!record) return
    if (!confirm(`Delete ${isSet ? 'set' : 'playlist'} "${record.name}"?`)) return
    if (collection.kind === 'playlist') void deletePlaylist(collection.id)
    else if (collection.kind === 'set') void deleteSet(collection.id)
    setCollection({ kind: 'all' })
  }

  // Smart-crate save/update affordances.
  const crateDirty = openCrate ? canonicalQuery(query) !== canonicalQuery(openCrate.query) : false
  const editableTitle = ordered || collection.kind === 'crate'
  const openSaveCrate = () => {
    setCrateName('')
    setSavingCrate(true)
  }
  const saveAsCrate = async () => {
    const name = crateName.trim()
    if (!name) return
    const id = await createSmartCrate(name, query)
    setSavingCrate(false)
    setCollection({ kind: 'crate', id })
  }
  const updateOpenCrate = () => {
    if (openCrate) void updateSmartCrate(openCrate.id, { query })
  }

  const filterRightSlot =
    collection.kind === 'crate' ? (
      crateDirty ? (
        <>
          <button className={slotPrimary} onClick={updateOpenCrate}>
            Update crate
          </button>
          <button className={slotGhost} onClick={openSaveCrate}>
            Save as new
          </button>
        </>
      ) : (
        <span className="text-xs text-zinc-500">Saved&nbsp;✓</span>
      )
    ) : filterActive ? (
      <button className={slotGhost} onClick={openSaveCrate}>
        Save as crate
      </button>
    ) : null

  const missingRecord = ordered && !record

  // The Transitions view and My Spotify page are their own things (not track collections).
  if (collection.kind === 'transitions') return <TransitionsList />
  if (collection.kind === 'spotify') return <SpotifyPage />

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        {editableTitle ? (
          <input
            className={`${inputCls} max-w-xs text-base font-semibold`}
            value={(ordered ? record?.name : openCrate?.name) ?? ''}
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
          {viewMode === 'list' && !ordered && (
            <button
              className={btn.ghost}
              onClick={() => setColumnsOpen(true)}
              title="Columns"
              aria-label="Columns"
            >
              ⚙
            </button>
          )}
          {(ordered || collection.kind === 'crate') && (
            <button className={btn.ghost} onClick={removeCollection}>
              Delete
            </button>
          )}
          <button className={btn.primary} onClick={() => setAdding(true)}>
            + Add track
          </button>
        </div>
      </div>

      {listTracks.length > 0 && (
        <FilterBar query={query} onChange={setQuery} tracks={listTracks} rightSlot={filterRightSlot} />
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
                <TrackTable
                  tracks={displayTracks}
                  annCount={annCount}
                  edgeCount={edgeCount}
                  onRowClick={selectTrack}
                  editable
                  columnConfig={columnConfig}
                />
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
      <ColumnsMenu
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        config={columnConfig ?? { order: [], hidden: [] }}
        onChange={updateColumns}
      />
      <Modal open={savingCrate} onClose={() => setSavingCrate(false)} title="Save smart crate" maxW="max-w-sm">
        <div className="space-y-3">
          <input
            className={inputCls}
            autoFocus
            placeholder="Crate name (e.g. Peak-time house)"
            value={crateName}
            onChange={(e) => setCrateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveAsCrate()
            }}
          />
          <p className="text-xs text-zinc-500">Saves the current filter as a crate in the sidebar.</p>
          <div className="flex justify-end gap-2">
            <button className={btn.ghost} onClick={() => setSavingCrate(false)}>
              Cancel
            </button>
            <button className={btn.primary} onClick={() => void saveAsCrate()} disabled={!crateName.trim()}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function EmptyMessage() {
  return <div className="mt-16 text-center text-sm text-zinc-500">No tracks here yet.</div>
}
