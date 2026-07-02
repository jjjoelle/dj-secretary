import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useUi } from '../store/ui'
import { isSpotifyConfigured } from '../lib/spotify'
import { fuzzyScore } from '../lib/fuzzy'
import { Modal, inputCls } from './common/widgets'

type Group = 'Section' | 'Smart crate' | 'Playlist' | 'Set' | 'Folder' | 'Track'

interface PaletteItem {
  id: string
  label: string
  sublabel?: string
  group: Group
  action: () => void
}

// A keyboard-first "go to…" palette. Pure navigation over the library's own
// objects — deterministic verbs (jump to a collection / open a track), never a
// suggestion. Opened globally with Cmd/Ctrl-K (see App.tsx).
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const setCollection = useUi((s) => s.setCollection)
  const selectTrack = useUi((s) => s.selectTrack)

  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const crates = useLiveQuery(() => db.smartCrates.orderBy('createdAt').toArray(), [])
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), [])
  const sets = useLiveQuery(() => db.sets.orderBy('createdAt').toArray(), [])
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray(), [])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      { id: 'sec:all', label: 'All Tracks', group: 'Section', action: () => setCollection({ kind: 'all' }) },
      { id: 'sec:transitions', label: 'Transitions', group: 'Section', action: () => setCollection({ kind: 'transitions' }) },
    ]
    if (isSpotifyConfigured()) {
      list.push({ id: 'sec:spotify', label: 'My Spotify', group: 'Section', action: () => setCollection({ kind: 'spotify' }) })
    }
    ;(crates ?? []).forEach((c) =>
      list.push({ id: 'crate:' + c.id, label: c.name, group: 'Smart crate', action: () => setCollection({ kind: 'crate', id: c.id }) }),
    )
    ;(playlists ?? []).forEach((p) =>
      list.push({ id: 'pl:' + p.id, label: p.name, group: 'Playlist', action: () => setCollection({ kind: 'playlist', id: p.id }) }),
    )
    ;(sets ?? []).forEach((s) =>
      list.push({ id: 'set:' + s.id, label: s.name, group: 'Set', action: () => setCollection({ kind: 'set', id: s.id }) }),
    )
    ;(folders ?? []).forEach((f) =>
      list.push({
        id: 'folder:' + f.id,
        label: f.name,
        sublabel: f.kind === 'set' ? 'set folder' : 'playlist folder',
        group: 'Folder',
        // A folder isn't a Collection — jump to its first child, else All Tracks.
        action: () => {
          const kids = f.kind === 'playlist' ? (playlists ?? []) : (sets ?? [])
          const first = kids.find((x) => x.folderId === f.id)
          if (first) setCollection({ kind: f.kind, id: first.id })
          else setCollection({ kind: 'all' })
        },
      }),
    )
    ;(tracks ?? []).forEach((t) =>
      list.push({ id: 'track:' + t.id, label: t.title, sublabel: t.artist, group: 'Track', action: () => selectTrack(t.id) }),
    )
    return list
  }, [tracks, crates, playlists, sets, folders, setCollection, selectTrack])

  const grouped = q.trim() === ''
  const results = useMemo(() => {
    if (grouped) {
      // Default view: everything except tracks, then the first few tracks (keep the DOM light).
      const nonTrack = items.filter((it) => it.group !== 'Track')
      const someTracks = items.filter((it) => it.group === 'Track').slice(0, 8)
      return [...nonTrack, ...someTracks]
    }
    const scored: { it: PaletteItem; score: number; idx: number }[] = []
    items.forEach((it, idx) => {
      const s = fuzzyScore(it.label + ' ' + (it.sublabel ?? ''), q)
      if (s != null) scored.push({ it, score: s, idx })
    })
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    return scored.slice(0, 50).map((x) => x.it)
  }, [items, q, grouped])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)))
  }, [results])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (i: number) => {
    const r = results[i]
    if (!r) return
    r.action()
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    }
    // Escape is handled by Modal's own window listener → onClose.
  }

  return (
    <Modal open={open} onClose={onClose} title="Go to…" maxW="max-w-xl">
      <div onKeyDown={onKeyDown}>
        <input
          autoFocus
          className={inputCls}
          value={q}
          onChange={(e) => {
            setActive(0)
            setQ(e.target.value)
          }}
          placeholder="Search tracks, crates, playlists, sets…"
        />
        <div ref={listRef} className="mt-2 max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-zinc-500">No matches.</div>
          ) : (
            results.map((r, i) => {
              const showHeader = grouped && (i === 0 || results[i - 1].group !== r.group)
              return (
                <div key={r.id}>
                  {showHeader && (
                    <div className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wider text-zinc-500">{r.group}</div>
                  )}
                  <button
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(i)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                      i === active ? 'bg-accent/20 text-zinc-100' : 'text-zinc-300 hover:bg-panel2'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {!grouped && (
                      <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-zinc-500">{r.group}</span>
                    )}
                    {r.sublabel && <span className="shrink-0 truncate text-xs text-zinc-500">{r.sublabel}</span>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
