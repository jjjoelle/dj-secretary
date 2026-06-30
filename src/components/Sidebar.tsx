import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createPlaylist, createSet } from '../db/db'
import { useUi } from '../store/ui'
import type { Collection } from '../store/ui'

export function Sidebar() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), [])
  const sets = useLiveQuery(() => db.sets.orderBy('createdAt').toArray(), [])
  const edgeCount = useLiveQuery(() => db.edges.count(), [])

  const collection = useUi((s) => s.collection)
  const setCollection = useUi((s) => s.setCollection)

  const artists = useMemo(() => {
    const counts = new Map<string, number>()
    tracks?.forEach((t) => counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tracks])

  const genres = useMemo(() => {
    const counts = new Map<string, number>()
    tracks?.forEach((t) => {
      if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tracks])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    tracks?.forEach((t) => t.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tracks])

  const isActive = (c: Collection) =>
    collection.kind === c.kind &&
    ('value' in collection && 'value' in c ? collection.value === c.value : true) &&
    ('id' in collection && 'id' in c ? collection.id === c.id : true)

  const createAndOpen = async (kind: 'playlist' | 'set') => {
    if (kind === 'playlist') {
      const id = await createPlaylist('New playlist')
      setCollection({ kind: 'playlist', id })
    } else {
      const id = await createSet('New set')
      setCollection({ kind: 'set', id })
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-edge bg-panel">
      <Section title="Library">
        <NavItem label="All Tracks" count={tracks?.length} active={isActive({ kind: 'all' })} onClick={() => setCollection({ kind: 'all' })} />
        <NavItem
          label="Transitions"
          count={edgeCount}
          active={isActive({ kind: 'transitions' })}
          onClick={() => setCollection({ kind: 'transitions' })}
        />
        <Group label="Artists" count={artists.length}>
          {artists.map(([name, n]) => (
            <NavItem
              key={name}
              label={name}
              count={n}
              indent
              active={isActive({ kind: 'artist', value: name })}
              onClick={() => setCollection({ kind: 'artist', value: name })}
            />
          ))}
        </Group>
        <Group label="Genres" count={genres.length}>
          {genres.map(([name, n]) => (
            <NavItem
              key={name}
              label={name}
              count={n}
              indent
              active={isActive({ kind: 'genre', value: name })}
              onClick={() => setCollection({ kind: 'genre', value: name })}
            />
          ))}
        </Group>
        <Group label="Tags" count={tags.length}>
          {tags.map(([tag, n]) => (
            <NavItem
              key={tag}
              label={`#${tag}`}
              count={n}
              indent
              active={isActive({ kind: 'tag', value: tag })}
              onClick={() => setCollection({ kind: 'tag', value: tag })}
            />
          ))}
        </Group>
      </Section>

      <Section title="Playlists" onAdd={() => void createAndOpen('playlist')}>
        {(playlists ?? []).map((p) => (
          <NavItem
            key={p.id}
            label={p.name}
            count={p.trackIds.length}
            active={isActive({ kind: 'playlist', id: p.id })}
            onClick={() => setCollection({ kind: 'playlist', id: p.id })}
          />
        ))}
        {playlists && playlists.length === 0 && <Empty>No playlists</Empty>}
      </Section>

      <Section title="Sets" onAdd={() => void createAndOpen('set')}>
        {(sets ?? []).map((s) => (
          <NavItem
            key={s.id}
            label={s.name}
            count={s.trackIds.length}
            active={isActive({ kind: 'set', id: s.id })}
            onClick={() => setCollection({ kind: 'set', id: s.id })}
          />
        ))}
        {sets && sets.length === 0 && <Empty>No sets</Empty>}
      </Section>
    </aside>
  )
}

function Section({
  title,
  onAdd,
  children,
}: {
  title: string
  onAdd?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="rounded px-1.5 text-zinc-400 hover:bg-edge hover:text-zinc-100"
            aria-label={`New ${title.slice(0, -1).toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
      <div className="mt-0.5 space-y-0.5">{children}</div>
    </div>
  )
}

function Group({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-zinc-400 hover:bg-panel2"
      >
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{label}</span>
        {count != null && <span className="text-[10px] text-zinc-600">{count}</span>}
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

function NavItem({
  label,
  count,
  active,
  indent,
  onClick,
}: {
  label: string
  count?: number
  active?: boolean
  indent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
        indent ? 'pl-6' : ''
      } ${active ? 'bg-accent/20 text-zinc-100' : 'text-zinc-300 hover:bg-panel2'}`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="text-[11px] text-zinc-500">{count}</span>}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-xs text-zinc-600">{children}</div>
}
