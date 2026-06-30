import { Fragment, useMemo } from 'react'
import type { Edge, Track } from '../../types'
import { formatTime } from '../../lib/time'
import { Stars } from '../common/widgets'

// A linear sequence of the current collection's tracks with the vetted transition
// (or a "no vetted transition" gap) shown between each consecutive pair — like a
// Set's connectors, but available for any collection (playlists, artists, etc.).
export function LinearView({
  tracks,
  edges,
  onRowClick,
}: {
  tracks: Track[]
  edges: Edge[]
  onRowClick: (id: string) => void
}) {
  const edgeBetween = useMemo(() => {
    const m = new Map<string, Edge>()
    edges.forEach((e) => {
      const k = `${e.fromTrackId}->${e.toTrackId}`
      if (!m.has(k)) m.set(k, e)
    })
    return (from: string, to: string) => m.get(`${from}->${to}`)
  }, [edges])

  if (tracks.length === 0) {
    return <div className="mt-16 text-center text-sm text-zinc-500">No tracks here yet.</div>
  }

  return (
    <ol className="space-y-1">
      {tracks.map((t, i) => {
        const next = tracks[i + 1]
        const edge = next ? edgeBetween(t.id, next.id) : undefined
        return (
          <Fragment key={`${t.id}:${i}`}>
            <li className="flex items-center gap-3 rounded-md border border-edge bg-panel2 px-3 py-2">
              <span className="w-6 text-right text-xs text-zinc-500">{i + 1}</span>
              <button
                className="min-w-0 flex-1 truncate text-left text-sm text-zinc-100 hover:text-accent"
                onClick={() => onRowClick(t.id)}
              >
                {t.title} <span className="text-zinc-400">— {t.artist}</span>
              </button>
              {t.bpm != null && <span className="text-xs text-zinc-500">{t.bpm} BPM</span>}
              {t.key && <span className="text-xs text-violet-300">{t.key}</span>}
              {t.durationSec != null && <span className="text-xs text-zinc-500">{formatTime(t.durationSec)}</span>}
            </li>
            {next && (
              <li className="flex flex-wrap items-center gap-2 pl-9 text-xs">
                {edge ? (
                  <>
                    <span className="text-accent">↓</span>
                    <span className="text-zinc-400">{edge.technique || 'transition'}</span>
                    <Stars value={edge.rating} />
                    {(edge.tags ?? []).map((tag) => (
                      <span key={tag} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
                        {tag}
                      </span>
                    ))}
                  </>
                ) : (
                  <>
                    <span className="text-amber-500">↓ ⚠</span>
                    <span className="text-amber-500/80">no vetted transition</span>
                  </>
                )}
              </li>
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}
