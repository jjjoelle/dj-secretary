import type { ColumnConfig } from '../../types'
import { Modal } from '../common/widgets'
import { orderColumnMeta } from './TrackTable'

// Show/hide and reorder the track-table columns. Title is pinned (always shown,
// always first). Writes a ColumnConfig back to the caller, which persists it in
// the local `meta` table — column layout is device-local, never exported.
export function ColumnsMenu({
  open,
  onClose,
  config,
  onChange,
}: {
  open: boolean
  onClose: () => void
  config: ColumnConfig
  onChange: (c: ColumnConfig) => void
}) {
  const ordered = orderColumnMeta(config) // all columns, in display order
  const hidden = new Set(config.hidden ?? [])
  const order: string[] = ordered.map((c) => c.key)

  const toggleHide = (key: string) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ order, hidden: [...next] })
  }

  const move = (key: string, dir: -1 | 1) => {
    const arr = [...order]
    const i = arr.indexOf(key)
    const j = i + dir
    // Can't move Title (index 0) or move anything into Title's slot.
    if (i <= 0 || j <= 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange({ order: arr, hidden: [...hidden] })
  }

  return (
    <Modal open={open} onClose={onClose} title="Columns" maxW="max-w-xs">
      <ul className="space-y-0.5">
        {ordered.map((c, i) => {
          const shown = c.pinned || !hidden.has(c.key)
          return (
            <li key={c.key} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-panel2">
              <input
                type="checkbox"
                checked={shown}
                disabled={c.pinned}
                onChange={() => toggleHide(c.key)}
                className="accent-accent disabled:opacity-50"
                aria-label={`Show ${c.label}`}
              />
              <span className="flex-1 text-sm text-zinc-200">
                {c.label}
                {c.pinned && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-zinc-500">pinned</span>}
              </span>
              <button
                onClick={() => move(c.key, -1)}
                disabled={i <= 1}
                className="rounded px-1 text-zinc-500 hover:bg-edge hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={`Move ${c.label} up`}
              >
                ▲
              </button>
              <button
                onClick={() => move(c.key, 1)}
                disabled={i === 0 || i === ordered.length - 1}
                className="rounded px-1 text-zinc-500 hover:bg-edge hover:text-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={`Move ${c.label} down`}
              >
                ▼
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500">Column layout is saved on this device only.</p>
    </Modal>
  )
}
