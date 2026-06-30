import { useMemo, useState } from 'react'
import type { Track } from '../../types'
import { formatTime } from '../../lib/time'

type SortKey = 'title' | 'artist' | 'bpm' | 'key' | 'energy' | 'genre' | 'duration' | 'notes' | 'transitions'

interface Column {
  key: SortKey
  label: string
  align?: 'right'
  className?: string
}

const COLUMNS: Column[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'bpm', label: 'BPM', align: 'right' },
  { key: 'key', label: 'Key', align: 'right' },
  { key: 'energy', label: 'Energy', align: 'right' },
  { key: 'genre', label: 'Genre' },
  { key: 'duration', label: 'Time', align: 'right' },
  { key: 'notes', label: 'Notes', align: 'right' },
  { key: 'transitions', label: 'Trans.', align: 'right' },
]

export function TrackTable({
  tracks,
  annCount,
  edgeCount,
  onRowClick,
}: {
  tracks: Track[]
  annCount: Map<string, number>
  edgeCount: Map<string, number>
  onRowClick: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'title', dir: 1 })

  const sorted = useMemo(() => {
    const val = (t: Track): string | number => {
      switch (sort.key) {
        case 'title':
          return t.title.toLowerCase()
        case 'artist':
          return t.artist.toLowerCase()
        case 'genre':
          return (t.genre ?? '').toLowerCase()
        case 'key':
          return t.key ?? ''
        case 'bpm':
          return t.bpm ?? -1
        case 'energy':
          return t.energy ?? -1
        case 'duration':
          return t.durationSec ?? -1
        case 'notes':
          return annCount.get(t.id) ?? 0
        case 'transitions':
          return edgeCount.get(t.id) ?? 0
      }
    }
    return [...tracks].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (av < bv) return -1 * sort.dir
      if (av > bv) return 1 * sort.dir
      return a.title.localeCompare(b.title)
    })
  }, [tracks, sort, annCount, edgeCount])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-ink">
        <tr className="border-b border-edge text-xs text-zinc-500">
          {COLUMNS.map((c) => (
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
          ))}
          <th className="px-3 py-2 text-left font-medium">Tags</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr
            key={t.id}
            onClick={() => onRowClick(t.id)}
            className="cursor-pointer border-b border-edge/50 hover:bg-panel2"
          >
            <td className="px-3 py-2">
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
            </td>
            <td className="px-3 py-2 text-zinc-300">{t.artist}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{t.bpm ?? '–'}</td>
            <td className="px-3 py-2 text-right text-violet-300">{t.key ?? '–'}</td>
            <td className="px-3 py-2 text-right text-amber-300">{t.energy ?? '–'}</td>
            <td className="px-3 py-2 text-zinc-400">{t.genre ?? '–'}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{formatTime(t.durationSec)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{annCount.get(t.id) ?? 0}</td>
            <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{edgeCount.get(t.id) ?? 0}</td>
            <td className="px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {t.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
                    {tag}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
