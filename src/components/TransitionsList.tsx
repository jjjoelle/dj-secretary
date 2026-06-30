import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useUi } from '../store/ui'
import { allEdgeTags, edgesWithTags } from '../lib/edges'
import { annotationMeta } from '../lib/music'
import { formatTime } from '../lib/time'
import { Stars } from './common/widgets'

// A flat, filterable list of every transition — the "pull up all my ? ideas" view.
export function TransitionsList() {
  // createdAt isn't indexed on the edges store, so sort in JS rather than orderBy.
  const edges = useLiveQuery(() => db.edges.toArray(), [])
  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const annotations = useLiveQuery(() => db.annotations.toArray(), [])
  const selectTrack = useUi((s) => s.selectTrack)
  const setFocusTrack = useUi((s) => s.setFocusTrack)
  const [tagFilter, setTagFilter] = useState<string[]>([])

  const trackById = useMemo(() => new Map((tracks ?? []).map((t) => [t.id, t])), [tracks])
  const annById = useMemo(() => new Map((annotations ?? []).map((a) => [a.id, a])), [annotations])
  const tags = useMemo(() => allEdgeTags(edges ?? []), [edges])
  const visible = useMemo(
    () => edgesWithTags([...(edges ?? [])].sort((a, b) => b.createdAt - a.createdAt), tagFilter),
    [edges, tagFilter],
  )

  const cue = (id?: string): string | null => {
    if (!id) return null
    const a = annById.get(id)
    return a ? `${annotationMeta(a.type).short} ${formatTime(a.timestampSec)}` : null
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        <h1 className="text-base font-semibold text-zinc-100">Transitions</h1>
        <span className="text-xs text-zinc-500">
          {tagFilter.length ? `${visible.length} of ` : ''}
          {edges?.length ?? 0} transitions
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-4 py-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Tag</span>
          {tags.map((tag) => {
            const on = tagFilter.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(on ? tagFilter.filter((x) => x !== tag) : [...tagFilter, tag])}
                className={`rounded-full px-2 py-0.5 text-xs transition ${
                  on ? 'bg-accent text-white' : 'bg-panel2 text-zinc-300 hover:bg-edge'
                }`}
              >
                {tag}
              </button>
            )
          })}
          {tagFilter.length > 0 && (
            <button onClick={() => setTagFilter([])} className="ml-1 text-xs text-zinc-500 hover:text-zinc-200">
              clear
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!edges || edges.length === 0 ? (
          <div className="mt-16 text-center text-sm text-zinc-500">
            No transitions yet. Draw an edge between two tracks in the graph, or add one from a track's inspector.
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-16 text-center text-sm text-zinc-500">No transitions with that tag.</div>
        ) : (
          <ul className="space-y-1">
            {visible.map((e) => {
              const from = trackById.get(e.fromTrackId)
              const to = trackById.get(e.toTrackId)
              const exit = cue(e.exitCueId)
              const entry = cue(e.entryCueId)
              return (
                <li key={e.id} className="rounded-md border border-edge bg-panel2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      className="min-w-0 flex-1 truncate text-left text-sm text-zinc-100 hover:text-accent"
                      onClick={() => {
                        selectTrack(e.fromTrackId)
                        setFocusTrack(e.fromTrackId)
                      }}
                    >
                      {from ? from.title : '(deleted)'}
                      <span className="text-accent"> → </span>
                      {to ? to.title : '(deleted)'}
                    </button>
                    <Stars value={e.rating} />
                  </div>
                  {e.technique && <div className="mt-0.5 text-xs text-zinc-400">{e.technique}</div>}
                  {((e.tags ?? []).length > 0 || exit || entry) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {(e.tags ?? []).map((t) => (
                        <span key={t} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
                          {t}
                        </span>
                      ))}
                      {(exit || entry) && (
                        <span className="ml-1 text-[11px] text-zinc-500">
                          {exit && `exit ${exit}`}
                          {exit && entry ? ' · ' : ''}
                          {entry && `entry ${entry}`}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
