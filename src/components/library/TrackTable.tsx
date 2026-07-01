import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Track, ColumnConfig } from '../../types'
import { formatTime, parseTime } from '../../lib/time'
import { CAMELOT_KEYS } from '../../lib/music'
import { TagInput } from '../common/widgets'
import { updateTrack } from '../../db/db'

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
}: {
  tracks: Track[]
  annCount: Map<string, number>
  edgeCount: Map<string, number>
  onRowClick: (id: string) => void
  editable?: boolean
  columnConfig?: ColumnConfig
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; dir: 1 | -1 }>({ key: 'title', dir: 1 })

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

  const toggle = (key: ColumnKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

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

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-ink">
        <tr className="border-b border-edge text-xs text-zinc-500">
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
      <tbody>
        {sorted.map((t) => (
          <tr
            key={t.id}
            onClick={() => onRow(t.id)}
            className="cursor-pointer border-b border-edge/50 hover:bg-panel2"
          >
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
