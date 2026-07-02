import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Track, ColumnConfig, Playlist } from '../../types'
import { formatTime, parseTime } from '../../lib/time'
import { CAMELOT_KEYS } from '../../lib/music'
import { TagInput, inputCls } from '../common/widgets'
import { updateTrack } from '../../db/db'
import { useUi } from '../../store/ui'

export type ColumnKey =
  | 'title'
  | 'artist'
  | 'bpm'
  | 'key'
  | 'energy'
  | 'genre'
  | 'duration'
  | 'notes'
  | 'transitions'
  | 'tags'

interface ColumnCtx {
  annCount: Map<string, number>
  edgeCount: Map<string, number>
}

// How a cell becomes editable: read the current value as a string, and coerce a
// raw input string back into a Track patch (mirrors AddTrackModal's save()).
interface EditConfig {
  kind: 'text' | 'number' | 'key'
  get: (t: Track) => string
  set: (raw: string) => Partial<Track>
}

interface Column {
  key: ColumnKey
  label: string
  align?: 'right'
  sortable?: boolean // default true
  sortValue?: (t: Track, ctx: ColumnCtx) => string | number
  tdClass: string
  render: (t: Track, ctx: ColumnCtx) => ReactNode
  edit?: EditConfig // scalar inline editor
  editTags?: boolean // tags array inline editor
}

// Every column declares how it sorts, renders, and (optionally) edits, so the
// header, body, and inline editing are all driven from this single list.
const COLUMNS: Column[] = [
  {
    key: 'title',
    label: 'Title',
    sortValue: (t) => t.title.toLowerCase(),
    tdClass: 'px-3 py-2',
    edit: { kind: 'text', get: (t) => t.title, set: (raw) => (raw.trim() ? { title: raw.trim() } : {}) },
    render: (t) => (
      <div className="flex items-center gap-2">
        {t.albumArtUrl ? (
          <img src={t.albumArtUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-panel2 text-xs text-zinc-600">
            ♪
          </div>
        )}
        <span className="truncate text-zinc-100">{t.title}</span>
      </div>
    ),
  },
  {
    key: 'artist',
    label: 'Artist',
    sortValue: (t) => t.artist.toLowerCase(),
    tdClass: 'px-3 py-2 text-zinc-300',
    edit: { kind: 'text', get: (t) => t.artist, set: (raw) => (raw.trim() ? { artist: raw.trim() } : {}) },
    render: (t) => t.artist,
  },
  {
    key: 'bpm',
    label: 'BPM',
    align: 'right',
    sortValue: (t) => t.bpm ?? -1,
    tdClass: 'px-3 py-2 text-right tabular-nums text-zinc-400',
    edit: { kind: 'number', get: (t) => t.bpm?.toString() ?? '', set: (raw) => ({ bpm: raw.trim() === '' ? undefined : Number(raw) }) },
    render: (t) => t.bpm ?? '–',
  },
  {
    key: 'key',
    label: 'Key',
    align: 'right',
    sortValue: (t) => t.key ?? '',
    tdClass: 'px-3 py-2 text-right text-violet-300',
    edit: { kind: 'key', get: (t) => t.key ?? '', set: (raw) => ({ key: raw || undefined }) },
    render: (t) => t.key ?? '–',
  },
  {
    key: 'energy',
    label: 'Energy',
    align: 'right',
    sortValue: (t) => t.energy ?? -1,
    tdClass: 'px-3 py-2 text-right text-amber-300',
    edit: { kind: 'number', get: (t) => t.energy?.toString() ?? '', set: (raw) => ({ energy: raw.trim() === '' ? undefined : Number(raw) }) },
    render: (t) => t.energy ?? '–',
  },
  {
    key: 'genre',
    label: 'Genre',
    sortValue: (t) => (t.genre ?? '').toLowerCase(),
    tdClass: 'px-3 py-2 text-zinc-400',
    edit: { kind: 'text', get: (t) => t.genre ?? '', set: (raw) => ({ genre: raw.trim() || undefined }) },
    render: (t) => t.genre ?? '–',
  },
  {
    key: 'duration',
    label: 'Time',
    align: 'right',
    sortValue: (t) => t.durationSec ?? -1,
    tdClass: 'px-3 py-2 text-right tabular-nums text-zinc-400',
    edit: {
      kind: 'text',
      get: (t) => (t.durationSec != null ? formatTime(t.durationSec) : ''),
      set: (raw) => ({ durationSec: raw.trim() === '' ? undefined : (parseTime(raw) ?? undefined) }),
    },
    render: (t) => formatTime(t.durationSec),
  },
  {
    key: 'notes',
    label: 'Notes',
    align: 'right',
    sortValue: (t, ctx) => ctx.annCount.get(t.id) ?? 0,
    tdClass: 'px-3 py-2 text-right tabular-nums text-zinc-400',
    render: (t, ctx) => ctx.annCount.get(t.id) ?? 0,
  },
  {
    key: 'transitions',
    label: 'Trans.',
    align: 'right',
    sortValue: (t, ctx) => ctx.edgeCount.get(t.id) ?? 0,
    tdClass: 'px-3 py-2 text-right tabular-nums text-zinc-400',
    render: (t, ctx) => ctx.edgeCount.get(t.id) ?? 0,
  },
  {
    key: 'tags',
    label: 'Tags',
    sortable: false,
    tdClass: 'px-3 py-2',
    editTags: true,
    render: (t) => (
      <div className="flex flex-wrap gap-1">
        {t.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
            {tag}
          </span>
        ))}
      </div>
    ),
  },
]

export interface ColumnMeta {
  key: ColumnKey
  label: string
  pinned?: boolean // Title is pinned: always visible, always first.
}

// Lightweight descriptors (no render fns) for the "Columns" menu.
export const TRACK_COLUMNS: ColumnMeta[] = COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
  pinned: c.key === 'title',
}))

// Full display order of ALL columns for a saved config: Title pinned first, then
// the configured order, then any columns not yet mentioned (e.g. added later in
// code). Unknown ids in the saved order are ignored.
function computeFullOrder(cfg?: ColumnConfig): ColumnKey[] {
  const all = COLUMNS.map((c) => c.key)
  const out: ColumnKey[] = ['title']
  const seen = new Set<string>(['title'])
  for (const k of cfg?.order ?? []) {
    if (k !== 'title' && !seen.has(k) && (all as string[]).includes(k)) {
      out.push(k as ColumnKey)
      seen.add(k)
    }
  }
  for (const k of all) {
    if (!seen.has(k)) {
      out.push(k)
      seen.add(k)
    }
  }
  return out
}

// Columns in display order INCLUDING hidden ones — for the Columns menu.
export function orderColumnMeta(cfg?: ColumnConfig): ColumnMeta[] {
  const byKey = new Map(TRACK_COLUMNS.map((c) => [c.key, c]))
  return computeFullOrder(cfg).map((k) => byKey.get(k) as ColumnMeta)
}

const editBase = 'w-full rounded border border-accent bg-ink px-1.5 py-0.5 text-sm text-zinc-100 focus:outline-none'

export function TrackTable({
  tracks,
  annCount,
  edgeCount,
  onRowClick,
  editable = false,
  columnConfig,
  sortConfig,
  onSortChange,
  playlists = [],
  onDeleteSelected,
  onAddToPlaylist,
}: {
  tracks: Track[]
  annCount: Map<string, number>
  edgeCount: Map<string, number>
  onRowClick: (id: string) => void
  editable?: boolean
  columnConfig?: ColumnConfig
  sortConfig?: { key: string; dir: 1 | -1 } // persisted sort (device-local); undefined = internal default
  onSortChange?: (s: { key: string; dir: 1 | -1 }) => void
  playlists?: Playlist[] // for the bulk "add to playlist" menu
  onDeleteSelected?: (ids: string[]) => void | Promise<void>
  onAddToPlaylist?: (playlistId: string, ids: string[]) => void | Promise<void>
}) {
  // When a persisted sortConfig is supplied it's the source of truth; otherwise
  // fall back to internal state (default: Title ascending). An unknown saved key
  // (e.g. a renamed column) falls back too.
  const [internalSort, setInternalSort] = useState<{ key: ColumnKey; dir: 1 | -1 }>({ key: 'title', dir: 1 })
  const sort = useMemo<{ key: ColumnKey; dir: 1 | -1 }>(() => {
    if (sortConfig && COLUMNS.some((c) => c.key === sortConfig.key)) {
      return { key: sortConfig.key as ColumnKey, dir: sortConfig.dir === -1 ? -1 : 1 }
    }
    return internalSort
  }, [sortConfig, internalSort])

  // Visible columns in saved order (Title pinned first, hidden ones dropped).
  const cols = useMemo(() => {
    const hidden = new Set(columnConfig?.hidden ?? [])
    const byKey = new Map(COLUMNS.map((c) => [c.key, c]))
    return computeFullOrder(columnConfig)
      .map((k) => byKey.get(k) as Column)
      .filter((c) => c.key === 'title' || !hidden.has(c.key))
  }, [columnConfig])
  // Inline-edit state lives outside the sort memo so an in-progress edit isn't
  // reset when the live query re-runs after another track changes.
  const [editing, setEditing] = useState<{ id: string; key: ColumnKey } | null>(null)
  const [draft, setDraft] = useState('')
  // Bulk-selection state (ephemeral; not persisted). Keyed by track id.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagOp, setTagOp] = useState<null | 'add' | 'remove'>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [plMenuOpen, setPlMenuOpen] = useState(false)
  const [activeRow, setActiveRow] = useState(-1) // keyboard-highlighted row index into `sorted`; -1 = none
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const ctx = useMemo<ColumnCtx>(() => ({ annCount, edgeCount }), [annCount, edgeCount])

  // Distinguish a single click (open inspector) from a double click (edit a cell)
  // by deferring the row click briefly; a cell's dblclick cancels the pending open.
  const clickTimer = useRef<number | null>(null)
  const cancelRowClick = () => {
    if (clickTimer.current != null) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }
  useEffect(() => cancelRowClick, [])

  const onRow = (id: string) => {
    if (!editable) {
      onRowClick(id)
      return
    }
    cancelRowClick()
    clickTimer.current = window.setTimeout(() => {
      onRowClick(id)
      clickTimer.current = null
    }, 200)
  }

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key)
    const sortValue = col?.sortValue ?? ((t: Track) => t.title.toLowerCase())
    return [...tracks].sort((a, b) => {
      const av = sortValue(a, ctx)
      const bv = sortValue(b, ctx)
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return a.title.localeCompare(b.title)
    })
  }, [tracks, sort, ctx])

  // Keep the selection pruned to still-visible rows (runs whenever the visible
  // set changes), so a hidden-but-selected track can't be silently bulk-deleted.
  // Returns the same Set reference when nothing changed, so React bails out of
  // the follow-up render — cheap even though it runs often.
  const visibleIds = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])
  useEffect(() => {
    setSelected((sel) => {
      if (sel.size === 0) return sel
      let changed = false
      const next = new Set<string>()
      for (const id of sel) {
        if (visibleIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : sel
    })
  }, [visibleIds])

  const toggle = (key: ColumnKey) => {
    const next: { key: ColumnKey; dir: 1 | -1 } = {
      key,
      dir: sort.key === key ? ((sort.dir * -1) as 1 | -1) : 1,
    }
    setInternalSort(next)
    onSortChange?.(next)
  }

  const startEdit = (t: Track, c: Column) => {
    cancelRowClick()
    if (c.edit) setDraft(c.edit.get(t))
    setEditing({ id: t.id, key: c.key })
  }
  const commitRaw = async (t: Track, c: Column, raw: string) => {
    if (c.edit) {
      const changes = c.edit.set(raw)
      if (Object.keys(changes).length) await updateTrack(t.id, changes)
    }
    setEditing(null)
  }

  // ---- bulk selection (over the visible, sorted rows) ----
  const selCount = useMemo(() => sorted.reduce((n, t) => (selected.has(t.id) ? n + 1 : n), 0), [sorted, selected])
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const selectAll = () => setSelected(new Set(sorted.map((t) => t.id))) // all VISIBLE rows only
  const clearSel = () => setSelected(new Set())
  const selectedIds = () => sorted.filter((t) => selected.has(t.id)).map((t) => t.id)
  const applyTag = () => {
    const tag = tagDraft.trim()
    if (tag) {
      for (const t of sorted) {
        if (!selected.has(t.id)) continue
        if (tagOp === 'add' && !t.tags.includes(tag)) void updateTrack(t.id, { tags: [...t.tags, tag] })
        if (tagOp === 'remove' && t.tags.includes(tag)) void updateTrack(t.id, { tags: t.tags.filter((x) => x !== tag) })
      }
    }
    setTagDraft('')
    setTagOp(null)
  }
  const doDelete = () => {
    const ids = selectedIds()
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} track${ids.length > 1 ? 's' : ''}? This also removes their notes, transitions, and playlist entries.`))
      return
    void onDeleteSelected?.(ids)
    clearSel()
  }
  const doAddToPlaylist = (playlistId: string) => {
    void onAddToPlaylist?.(playlistId, selectedIds())
    setPlMenuOpen(false)
    clearSel()
  }

  // ---- keyboard row navigation (Up/Down move a highlight, Enter opens it) ----
  // Read live values through refs so the window listener attaches once.
  const activeRef = useRef(activeRow)
  const sortedRef = useRef(sorted)
  const editingRef = useRef(editing)
  useEffect(() => {
    activeRef.current = activeRow
  }, [activeRow])
  useEffect(() => {
    sortedRef.current = sorted
  }, [sorted])
  useEffect(() => {
    editingRef.current = editing
  }, [editing])
  // Reset the highlight when the row set changes identity (collection/filter/sort/edit).
  useEffect(() => setActiveRow(-1), [tracks, sort])
  useEffect(() => {
    if (activeRow < 0) return
    bodyRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeRow])
  useEffect(() => {
    if (!editable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
      if (useUi.getState().paletteOpen) return // never fight the palette
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return // never fight typing
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (editingRef.current) return // a cell is mid-edit
      if (e.key === 'Enter') {
        const i = activeRef.current
        if (i >= 0 && i < sortedRef.current.length) {
          e.preventDefault()
          onRowClick(sortedRef.current[i].id)
        }
        return
      }
      e.preventDefault()
      setActiveRow((a) => {
        const n = sortedRef.current.length
        if (n === 0) return -1
        if (a < 0) return e.key === 'ArrowDown' ? 0 : n - 1
        return e.key === 'ArrowDown' ? Math.min(a + 1, n - 1) : Math.max(a - 1, 0)
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editable, onRowClick])

  return (
    <div>
      {editable && sorted.length > 0 && (
        <div className="mb-3 flex min-h-[2rem] flex-wrap items-center gap-2">
          {selCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-panel2 px-2.5 py-1">
              <span className="text-xs text-zinc-300">{selCount} selected</span>
              {tagOp ? (
                <span className="flex items-center gap-1">
                  <input
                    className={`${inputCls} h-7 w-28 py-0`}
                    placeholder={tagOp === 'add' ? 'tag to add' : 'tag to remove'}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyTag()
                      if (e.key === 'Escape') {
                        setTagDraft('')
                        setTagOp(null)
                      }
                    }}
                    autoFocus
                  />
                  <button className="text-xs text-accent hover:underline" onClick={applyTag}>
                    apply
                  </button>
                </span>
              ) : (
                <>
                  <button className="text-xs text-zinc-300 hover:text-white" onClick={() => setTagOp('add')}>
                    + tag
                  </button>
                  <button className="text-xs text-zinc-300 hover:text-white" onClick={() => setTagOp('remove')}>
                    − tag
                  </button>
                </>
              )}
              <div className="relative">
                <button className="text-xs text-zinc-300 hover:text-white" onClick={() => setPlMenuOpen((o) => !o)}>
                  Add to playlist ▾
                </button>
                {plMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPlMenuOpen(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-edge bg-panel shadow-xl">
                      {playlists.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-500">No playlists yet.</div>
                      ) : (
                        playlists.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => doAddToPlaylist(p.id)}
                            className="block w-full truncate px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-panel2"
                          >
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <button className="text-xs text-zinc-300 hover:text-rose-400" onClick={doDelete}>
                Delete
              </button>
              <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={clearSel}>
                clear
              </button>
            </div>
          ) : (
            <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={selectAll}>
              Select all
            </button>
          )}
        </div>
      )}

      <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-ink">
        <tr className="border-b border-edge text-xs text-zinc-500">
          {editable && (
            <th className="w-8 px-2 py-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-violet-600"
                aria-label="Select all"
                checked={sorted.length > 0 && selCount === sorted.length}
                ref={(el) => {
                  if (el) el.indeterminate = selCount > 0 && selCount < sorted.length
                }}
                onChange={(e) => (e.target.checked ? selectAll() : clearSel())}
              />
            </th>
          )}
          {cols.map((c) =>
            c.sortable === false ? (
              <th
                key={c.key}
                className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ) : (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-zinc-300 ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {c.label}
                {sort.key === c.key && <span className="ml-1">{sort.dir === 1 ? '▲' : '▼'}</span>}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {sorted.map((t, i) => (
          <tr
            key={t.id}
            data-active={i === activeRow}
            onClick={() => onRow(t.id)}
            className={`group cursor-pointer border-b border-edge/50 ${
              selected.has(t.id) ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-panel2'
            } ${i === activeRow ? 'ring-1 ring-inset ring-accent/50' : ''}`}
          >
            {editable && (
              <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggleSel(t.id)}
                  onClick={(e) => e.stopPropagation()}
                  className={`h-3.5 w-3.5 accent-violet-600 transition-opacity ${
                    selected.has(t.id) || selCount > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label="Select track"
                />
              </td>
            )}
            {cols.map((c) => {
              const isEditing = editable && editing?.id === t.id && editing.key === c.key
              const canEdit = editable && (!!c.edit || !!c.editTags)
              return (
                <td
                  key={c.key}
                  className={c.tdClass}
                  title={canEdit && !isEditing ? 'Double-click to edit' : undefined}
                  onDoubleClick={
                    canEdit
                      ? (e) => {
                          e.stopPropagation()
                          startEdit(t, c)
                        }
                      : undefined
                  }
                >
                  {isEditing && c.editTags ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(null)
                      }}
                    >
                      <TagInput value={t.tags} onChange={(tags) => void updateTrack(t.id, { tags })} />
                    </div>
                  ) : isEditing && c.edit ? (
                    <ScalarEditor
                      kind={c.edit.kind}
                      alignRight={c.align === 'right'}
                      value={draft}
                      onDraft={setDraft}
                      onPick={(raw) => void commitRaw(t, c, raw)}
                      onCommit={() => void commitRaw(t, c, draft)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    c.render(t, ctx)
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  )
}

function ScalarEditor({
  kind,
  alignRight,
  value,
  onDraft,
  onPick,
  onCommit,
  onCancel,
}: {
  kind: 'text' | 'number' | 'key'
  alignRight: boolean
  value: string
  onDraft: (v: string) => void
  onPick: (raw: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const cls = `${editBase}${alignRight ? ' text-right' : ''}`
  if (kind === 'key') {
    return (
      <select
        autoFocus
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onPick(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onCancel()
        }}
        className={cls}
      >
        <option value="">—</option>
        {CAMELOT_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      autoFocus
      type={kind === 'number' ? 'number' : 'text'}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onDraft(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit()
        else if (e.key === 'Escape') onCancel()
      }}
      className={cls}
    />
  )
}
