import { useEffect, useMemo, useState } from 'react'
import type { Track } from '../../types'
import { formatTime } from '../../lib/time'
import { Modal, btn, inputCls } from '../common/widgets'

// A searchable, multi-select picker for adding library tracks to a playlist/set.
export function TrackPickerModal({
  open,
  onClose,
  candidates,
  onAdd,
  label = 'collection',
}: {
  open: boolean
  onClose: () => void
  candidates: Track[] // tracks not already in the collection
  onAdd: (ids: string[]) => void
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(new Set())
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const list =
      q === ''
        ? candidates
        : candidates.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.artist.toLowerCase().includes(q) ||
              (t.genre ?? '').toLowerCase().includes(q) ||
              t.tags.some((tag) => tag.toLowerCase().includes(q)),
          )
    return [...list].sort((a, b) => a.title.localeCompare(b.title))
  }, [candidates, q])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id))
  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allVisibleSelected) filtered.forEach((t) => n.delete(t.id))
      else filtered.forEach((t) => n.add(t.id))
      return n
    })

  const addSelected = () => {
    if (selected.size === 0) return
    onAdd([...selected])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add tracks to ${label}`} maxW="max-w-2xl">
      <div className="flex items-center gap-2">
        <input
          className={inputCls}
          placeholder="Search your library…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {filtered.length > 0 && (
          <button className="shrink-0 text-xs text-zinc-400 hover:text-zinc-100" onClick={toggleAllVisible}>
            {allVisibleSelected ? 'Clear' : 'Select all'}
          </button>
        )}
      </div>

      <ul className="mt-2 max-h-[48vh] min-h-[8rem] divide-y divide-edge overflow-y-auto rounded-md border border-edge">
        {filtered.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-zinc-500">
            {candidates.length === 0 ? 'Every track is already here.' : 'No matches.'}
          </li>
        )}
        {filtered.map((t) => {
          const on = selected.has(t.id)
          return (
            <li key={t.id}>
              <button
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-panel2"
              >
                <input type="checkbox" checked={on} readOnly className="pointer-events-none h-4 w-4 accent-violet-500" />
                {t.albumArtUrl ? (
                  <img src={t.albumArtUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-panel2 text-zinc-600">♪</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-100">{t.title}</div>
                  <div className="truncate text-xs text-zinc-400">{t.artist}</div>
                </div>
                {t.bpm != null && <span className="shrink-0 text-xs text-zinc-500">{t.bpm} BPM</span>}
                {t.key && <span className="shrink-0 text-xs text-violet-300">{t.key}</span>}
                {t.durationSec != null && (
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatTime(t.durationSec)}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{selected.size} selected</span>
        <div className="flex gap-2">
          <button className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={addSelected} disabled={selected.size === 0}>
            Add {selected.size > 0 ? selected.size : ''} track{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
