import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  createPlaylist,
  createSet,
  createFolder,
  updateFolder,
  deleteFolder,
  updatePlaylist,
  updateSet,
  metaGet,
  metaSet,
} from '../db/db'
import { matchesQuery } from '../lib/filter'
import { useUi } from '../store/ui'
import type { Collection } from '../store/ui'
import type { Folder } from '../types'

interface FolderableItem {
  id: string
  name: string
  trackIds: string[]
  folderId?: string
}

export function Sidebar() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const playlists = useLiveQuery(() => db.playlists.orderBy('createdAt').toArray(), [])
  const sets = useLiveQuery(() => db.sets.orderBy('createdAt').toArray(), [])
  const crates = useLiveQuery(() => db.smartCrates.orderBy('createdAt').toArray(), [])
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray(), [])
  const edgeCount = useLiveQuery(() => db.edges.count(), [])

  const collection = useUi((s) => s.collection)
  const setCollection = useUi((s) => s.setCollection)

  // Per-folder collapse state, persisted device-locally (not exported).
  const [collapse, setCollapse] = useState<Record<string, boolean>>({})
  useEffect(() => {
    void metaGet<Record<string, boolean>>('ui.folderCollapse').then((c) => {
      if (c) setCollapse(c)
    })
  }, [])
  const toggleCollapse = (id: string) =>
    setCollapse((c) => {
      const next = { ...c, [id]: !c[id] }
      void metaSet('ui.folderCollapse', next)
      return next
    })

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

  // Live match count for each crate (recomputed when crates or tracks change).
  const crateCounts = useMemo(() => {
    const m = new Map<string, number>()
    ;(crates ?? []).forEach((c) => m.set(c.id, (tracks ?? []).filter((t) => matchesQuery(t, c.query)).length))
    return m
  }, [crates, tracks])

  const playlistFolders = (folders ?? []).filter((f) => f.kind === 'playlist')
  const setFolders = (folders ?? []).filter((f) => f.kind === 'set')

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

  const removeFolder = (id: string) => {
    if (confirm('Delete this folder? Its items move back to the top level.')) void deleteFolder(id)
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

      {crates && crates.length > 0 && (
        <Section title="Smart Crates">
          {crates.map((c) => (
            <NavItem
              key={c.id}
              label={c.name}
              count={crateCounts.get(c.id)}
              active={isActive({ kind: 'crate', id: c.id })}
              onClick={() => setCollection({ kind: 'crate', id: c.id })}
            />
          ))}
        </Section>
      )}

      <Section
        title="Playlists"
        onAdd={() => void createAndOpen('playlist')}
        onAddFolder={() => void createFolder('New folder', 'playlist')}
      >
        <FolderedList
          kind="playlist"
          items={playlists ?? []}
          folders={playlistFolders}
          collapse={collapse}
          onToggleCollapse={toggleCollapse}
          isActive={(id) => isActive({ kind: 'playlist', id })}
          onOpen={(id) => setCollection({ kind: 'playlist', id })}
          onRenameFolder={(id, name) => void updateFolder(id, { name })}
          onDeleteFolder={removeFolder}
          onMoveItem={(id, folderId) => void updatePlaylist(id, { folderId })}
        />
        {playlists && playlists.length === 0 && playlistFolders.length === 0 && <Empty>No playlists</Empty>}
      </Section>

      <Section
        title="Sets"
        onAdd={() => void createAndOpen('set')}
        onAddFolder={() => void createFolder('New folder', 'set')}
      >
        <FolderedList
          kind="set"
          items={sets ?? []}
          folders={setFolders}
          collapse={collapse}
          onToggleCollapse={toggleCollapse}
          isActive={(id) => isActive({ kind: 'set', id })}
          onOpen={(id) => setCollection({ kind: 'set', id })}
          onRenameFolder={(id, name) => void updateFolder(id, { name })}
          onDeleteFolder={removeFolder}
          onMoveItem={(id, folderId) => void updateSet(id, { folderId })}
        />
        {sets && sets.length === 0 && setFolders.length === 0 && <Empty>No sets</Empty>}
      </Section>
    </aside>
  )
}

function FolderedList({
  items,
  folders,
  collapse,
  onToggleCollapse,
  isActive,
  onOpen,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
}: {
  kind: 'playlist' | 'set'
  items: FolderableItem[]
  folders: Folder[]
  collapse: Record<string, boolean>
  onToggleCollapse: (id: string) => void
  isActive: (id: string) => boolean
  onOpen: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
  onMoveItem: (id: string, folderId?: string) => void
}) {
  const folderIds = new Set(folders.map((f) => f.id))
  const inFolder = (fid: string) => items.filter((it) => it.folderId === fid)
  // Items with no folder — or pointing at a deleted/other-kind folder — are top-level.
  const ungrouped = items.filter((it) => !it.folderId || !folderIds.has(it.folderId))

  return (
    <>
      {folders.map((f) => {
        const children = inFolder(f.id)
        return (
          <FolderRow
            key={f.id}
            folder={f}
            open={!collapse[f.id]}
            childCount={children.length}
            onToggle={() => onToggleCollapse(f.id)}
            onRename={(name) => onRenameFolder(f.id, name)}
            onDelete={() => onDeleteFolder(f.id)}
          >
            {children.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                indent
                active={isActive(it.id)}
                onOpen={() => onOpen(it.id)}
                folders={folders}
                onMove={(fid) => onMoveItem(it.id, fid)}
              />
            ))}
            {children.length === 0 && <div className="px-2 py-1 pl-8 text-[11px] text-zinc-600">empty</div>}
          </FolderRow>
        )
      })}
      {ungrouped.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          active={isActive(it.id)}
          onOpen={() => onOpen(it.id)}
          folders={folders}
          onMove={(fid) => onMoveItem(it.id, fid)}
        />
      ))}
    </>
  )
}

function FolderRow({
  folder,
  open,
  childCount,
  onToggle,
  onRename,
  onDelete,
  children,
}: {
  folder: Folder
  open: boolean
  childCount: number
  onToggle: () => void
  onRename: (name: string) => void
  onDelete: () => void
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(folder.name)
  useEffect(() => setName(folder.name), [folder.name])
  const commit = () => {
    onRename(name.trim() || folder.name)
    setEditing(false)
  }

  return (
    <div className="group/folder">
      <div className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-panel2">
        <button onClick={onToggle} className="text-[10px]" aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? '▾' : '▸'}
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              else if (e.key === 'Escape') {
                setName(folder.name)
                setEditing(false)
              }
            }}
            className="min-w-0 flex-1 rounded bg-ink px-1 text-xs text-zinc-100 focus:outline-none"
          />
        ) : (
          <button
            onClick={onToggle}
            onDoubleClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left"
            title="Double-click to rename"
          >
            🗀 {folder.name}
          </button>
        )}
        <span className="text-[10px] text-zinc-600">{childCount}</span>
        <button
          onClick={onDelete}
          className="hidden text-zinc-500 hover:text-rose-400 group-hover/folder:block"
          title="Delete folder"
          aria-label="Delete folder"
        >
          ✕
        </button>
      </div>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

function ItemRow({
  item,
  active,
  indent,
  onOpen,
  folders,
  onMove,
}: {
  item: FolderableItem
  active: boolean
  indent?: boolean
  onOpen: () => void
  folders: Folder[]
  onMove: (folderId?: string) => void
}) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="group/item relative flex items-center">
      <button
        onClick={onOpen}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
          indent ? 'pl-7' : ''
        } ${active ? 'bg-accent/20 text-zinc-100' : 'text-zinc-300 hover:bg-panel2'}`}
      >
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <span className="text-[11px] text-zinc-500">{item.trackIds.length}</span>
      </button>
      <button
        onClick={() => setMenu((m) => !m)}
        className="absolute right-1 hidden rounded px-1 text-zinc-500 hover:text-zinc-100 group-hover/item:block"
        title="Move to folder"
        aria-label="Move to folder"
      >
        ⋯
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-1 top-8 z-20 w-44 rounded-md border border-edge bg-panel2 p-1 text-xs shadow-xl">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">Move to folder</div>
            <button
              onClick={() => {
                onMove(undefined)
                setMenu(false)
              }}
              className="block w-full rounded px-2 py-1 text-left text-zinc-300 hover:bg-edge"
            >
              No folder
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onMove(f.id)
                  setMenu(false)
                }}
                className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-edge ${
                  item.folderId === f.id ? 'text-accent' : 'text-zinc-300'
                }`}
              >
                {f.name}
              </button>
            ))}
            {folders.length === 0 && <div className="px-2 py-1 text-zinc-600">No folders yet</div>}
          </div>
        </>
      )}
    </div>
  )
}

function Section({
  title,
  onAdd,
  onAddFolder,
  children,
}: {
  title: string
  onAdd?: () => void
  onAddFolder?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="px-2 py-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
        <div className="flex items-center gap-0.5">
          {onAddFolder && (
            <button
              onClick={onAddFolder}
              className="rounded px-1 text-zinc-400 hover:bg-edge hover:text-zinc-100"
              title="New folder"
              aria-label={`New ${title.slice(0, -1).toLowerCase()} folder`}
            >
              🗀
            </button>
          )}
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
