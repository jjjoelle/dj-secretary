import { Fragment, useMemo, useState } from 'react'
import type { Edge, Track } from '../../types'
import { formatTime } from '../../lib/time'
import { updateTrack } from '../../db/db'
import { Stars, btn, inputCls } from '../common/widgets'
import { TrackPickerModal } from './TrackPickerModal'

export function OrderedList({
  trackIds,
  trackById,
  edges,
  isSet,
  availableTracks,
  onChange,
  onRowClick,
  readOnly = false,
}: {
  trackIds: string[]
  trackById: Map<string, Track>
  edges: Edge[]
  isSet: boolean
  availableTracks: Track[]
  onChange: (ids: string[]) => void
  onRowClick: (id: string) => void
  readOnly?: boolean
}) {
  const label = isSet ? 'set' : 'playlist'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  // Look up the (first) vetted transition between two tracks, for Set rendering.
  const edgeBetween = useMemo(() => {
    const map = new Map<string, Edge>()
    edges.forEach((e) => {
      const key = `${e.fromTrackId}->${e.toTrackId}`
      if (!map.has(key)) map.set(key, e)
    })
    return (from: string, to: string) => map.get(`${from}->${to}`)
  }, [edges])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= trackIds.length) return
    const next = [...trackIds]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const remove = (id: string) => onChange(trackIds.filter((t) => t !== id))
  const addMany = (ids: string[]) => onChange([...trackIds, ...ids.filter((id) => !trackIds.includes(id))])

  // ---- multi-select bulk editing (only meaningful in the editable view) ----
  const selCount = useMemo(() => trackIds.filter((id) => selected.has(id)).length, [trackIds, selected])
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const selectAll = () => setSelected(new Set(trackIds))
  const clearSel = () => setSelected(new Set())
  const bulkRemove = () => {
    onChange(trackIds.filter((id) => !selected.has(id)))
    clearSel()
  }
  const applyTag = () => {
    const tag = tagDraft.trim()
    if (tag) {
      trackIds.forEach((id) => {
        if (!selected.has(id)) return
        const t = trackById.get(id)
        if (t && !t.tags.includes(tag)) void updateTrack(id, { tags: [...t.tags, tag] })
      })
    }
    setTagDraft('')
    setShowTagInput(false)
  }

  return (
    <div>
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className={btn.primary} onClick={() => setPickerOpen(true)}>
            + Add tracks
          </button>
          {trackIds.length > 0 &&
            (selCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-panel2 px-2.5 py-1">
                <span className="text-xs text-zinc-300">{selCount} selected</span>
                {showTagInput ? (
                  <span className="flex items-center gap-1">
                    <input
                      className={`${inputCls} h-7 w-28 py-0`}
                      placeholder="tag"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyTag()
                        if (e.key === 'Escape') {
                          setTagDraft('')
                          setShowTagInput(false)
                        }
                      }}
                      autoFocus
                    />
                    <button className="text-xs text-accent hover:underline" onClick={applyTag}>
                      apply
                    </button>
                  </span>
                ) : (
                  <button className="text-xs text-zinc-300 hover:text-white" onClick={() => setShowTagInput(true)}>
                    + tag
                  </button>
                )}
                <button className="text-xs text-zinc-300 hover:text-rose-400" onClick={bulkRemove}>
                  Remove from {label}
                </button>
                <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={clearSel}>
                  clear
                </button>
              </div>
            ) : (
              <button className="text-xs text-zinc-400 hover:text-zinc-100" onClick={selectAll}>
                Select all
              </button>
            ))}
        </div>
      )}

      {trackIds.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {readOnly ? 'No tracks match the filter.' : `Empty ${label} — add tracks above.`}
        </p>
      ) : (
        <ol className="space-y-1">
          {trackIds.map((tid, i) => {
            const t = trackById.get(tid)
            const next = trackIds[i + 1]
            const edge = isSet && next ? edgeBetween(tid, next) : undefined
            const sel = selected.has(tid)
            return (
              <Fragment key={tid}>
                <li
                  className={`group flex items-center gap-3 rounded-md border px-3 py-2 ${
                    sel ? 'border-accent/40 bg-accent/10' : 'border-edge bg-panel2'
                  }`}
                >
                  {!readOnly && (
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggle(tid)}
                      className={`h-3.5 w-3.5 shrink-0 accent-violet-600 transition-opacity ${
                        sel || selCount > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label="Select track"
                    />
                  )}
                  <span className="w-6 text-right text-xs text-zinc-500">{i + 1}</span>
                  <button
                    className="min-w-0 flex-1 truncate text-left text-sm text-zinc-100 hover:text-accent"
                    onClick={() => t && onRowClick(t.id)}
                  >
                    {t ? (
                      <>
                        {t.title} <span className="text-zinc-400">— {t.artist}</span>
                      </>
                    ) : (
                      '(deleted track)'
                    )}
                  </button>
                  {t?.bpm != null && <span className="text-xs text-zinc-500">{t.bpm} BPM</span>}
                  {t?.key && <span className="text-xs text-violet-300">{t.key}</span>}
                  {t?.durationSec != null && <span className="text-xs text-zinc-500">{formatTime(t.durationSec)}</span>}
                  {!readOnly && (
                    <div className="flex items-center gap-1 text-zinc-500">
                      <button className="px-1 hover:text-zinc-100" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                      <button className="px-1 hover:text-zinc-100" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                      <button className="px-1 hover:text-rose-400" onClick={() => remove(tid)} aria-label="Remove">✕</button>
                    </div>
                  )}
                </li>

                {isSet && next && !readOnly && (
                  <li className="flex items-center gap-2 pl-9 text-xs">
                    {edge ? (
                      <>
                        <span className="text-accent">↓</span>
                        <span className="text-zinc-400">{edge.technique || 'transition'}</span>
                        <Stars value={edge.rating} />
                        {(edge.tags ?? []).map((t) => (
                          <span key={t} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
                            {t}
                          </span>
                        ))}
                      </>
                    ) : (
                      <>
                        <span className="text-amber-500">↓ ⚠</span>
                        <span className="text-amber-500/80">
                          no vetted transition — add one in the graph or inspector
                        </span>
                      </>
                    )}
                  </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      )}

      <TrackPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        candidates={availableTracks}
        onAdd={addMany}
        label={label}
      />
    </div>
  )
}
