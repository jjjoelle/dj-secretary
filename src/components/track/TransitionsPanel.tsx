import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateEdge, deleteEdge } from '../../db/db'
import type { Annotation, Edge, Track } from '../../types'
import { annotationMeta } from '../../lib/music'
import { formatTime } from '../../lib/time'
import { useUi } from '../../store/ui'
import { Stars, RatingInput, TagInput, btn, inputCls, labelCls } from '../common/widgets'
import { AddTransitionModal } from './AddTransitionModal'

export function TransitionsPanel({
  track,
  allTracks,
  outgoing,
  incoming,
}: {
  track: Track
  allTracks: Track[]
  outgoing: Edge[]
  incoming: Edge[]
}) {
  const [adding, setAdding] = useState(false)
  const annotations = useLiveQuery(() => db.annotations.toArray(), [])

  const trackById = useMemo(() => new Map(allTracks.map((t) => [t.id, t])), [allTracks])
  const annById = useMemo(
    () => new Map((annotations ?? []).map((a) => [a.id, a])),
    [annotations],
  )
  const annsByTrack = useMemo(() => {
    const m = new Map<string, Annotation[]>()
    ;(annotations ?? []).forEach((a) => {
      const arr = m.get(a.trackId) ?? []
      arr.push(a)
      m.set(a.trackId, arr)
    })
    return m
  }, [annotations])

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Transitions</h3>
        <button className={btn.ghost} onClick={() => setAdding(true)}>
          + Add
        </button>
      </div>

      <Group label="Flows out →">
        {outgoing.length === 0 && <Empty />}
        {outgoing.map((e) => (
          <EdgeRow
            key={e.id}
            edge={e}
            other={trackById.get(e.toTrackId)}
            annById={annById}
            annsByTrack={annsByTrack}
          />
        ))}
      </Group>

      <Group label="→ Flows in">
        {incoming.length === 0 && <Empty />}
        {incoming.map((e) => (
          <EdgeRow
            key={e.id}
            edge={e}
            other={trackById.get(e.fromTrackId)}
            annById={annById}
            annsByTrack={annsByTrack}
          />
        ))}
      </Group>

      <AddTransitionModal
        open={adding}
        onClose={() => setAdding(false)}
        sourceTrack={track}
        allTracks={allTracks}
      />
    </section>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-500">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Empty() {
  return <div className="px-1 py-1 text-xs text-zinc-600">None.</div>
}

function cueLabel(annById: Map<string, Annotation>, id?: string): string | null {
  if (!id) return null
  const a = annById.get(id)
  if (!a) return null
  return `${annotationMeta(a.type).short} ${formatTime(a.timestampSec)}`
}

function EdgeRow({
  edge,
  other,
  annById,
  annsByTrack,
}: {
  edge: Edge
  other?: Track
  annById: Map<string, Annotation>
  annsByTrack: Map<string, Annotation[]>
}) {
  const selectTrack = useUi((s) => s.selectTrack)
  const [editing, setEditing] = useState(false)
  const exit = cueLabel(annById, edge.exitCueId)
  const entry = cueLabel(annById, edge.entryCueId)

  if (editing) {
    return (
      <EdgeEditor
        edge={edge}
        annsByTrack={annsByTrack}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="rounded-md border border-edge bg-panel2 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <button
          className="min-w-0 flex-1 truncate text-left text-sm text-zinc-100 hover:text-accent"
          onClick={() => other && selectTrack(other.id)}
        >
          {other ? `${other.title} — ${other.artist}` : '(deleted track)'}
        </button>
        <Stars value={edge.rating} />
        <button className="text-xs text-zinc-500 hover:text-zinc-200" onClick={() => setEditing(true)}>
          edit
        </button>
        <button className="text-xs text-zinc-500 hover:text-rose-400" onClick={() => void deleteEdge(edge.id)}>
          ✕
        </button>
      </div>
      {edge.technique && <div className="mt-0.5 text-xs text-zinc-400">{edge.technique}</div>}
      {(edge.tags ?? []).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {(edge.tags ?? []).map((t) => (
            <span key={t} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
              {t}
            </span>
          ))}
        </div>
      )}
      {(exit || entry) && (
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
          {exit && <span>exit {exit}</span>}
          {entry && <span>entry {entry}</span>}
        </div>
      )}
    </div>
  )
}

function EdgeEditor({
  edge,
  annsByTrack,
  onDone,
}: {
  edge: Edge
  annsByTrack: Map<string, Annotation[]>
  onDone: () => void
}) {
  const [technique, setTechnique] = useState(edge.technique ?? '')
  const [tags, setTags] = useState<string[]>(edge.tags ?? [])
  const [rating, setRating] = useState<number | undefined>(edge.rating)
  const [exitCueId, setExitCueId] = useState(edge.exitCueId ?? '')
  const [entryCueId, setEntryCueId] = useState(edge.entryCueId ?? '')

  const fromAnns = (annsByTrack.get(edge.fromTrackId) ?? []).slice().sort((a, b) => a.timestampSec - b.timestampSec)
  const toAnns = (annsByTrack.get(edge.toTrackId) ?? []).slice().sort((a, b) => a.timestampSec - b.timestampSec)

  const save = async () => {
    await updateEdge(edge.id, {
      technique: technique.trim() || undefined,
      tags,
      rating,
      exitCueId: exitCueId || undefined,
      entryCueId: entryCueId || undefined,
    })
    onDone()
  }

  return (
    <div className="space-y-2 rounded-md border border-accent/40 bg-panel2 p-2.5">
      <input
        className={inputCls}
        value={technique}
        onChange={(e) => setTechnique(e.target.value)}
        placeholder="Technique"
      />
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>Tags</label>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-edge hover:text-zinc-100"
            onClick={() => setTags((t) => (t.includes('?') ? t : [...t, '?']))}
            title="Mark to explore later"
          >
            + ?
          </button>
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="Tag this transition…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Exit cue</label>
          <select className={inputCls} value={exitCueId} onChange={(e) => setExitCueId(e.target.value)}>
            <option value="">—</option>
            {fromAnns.map((a) => (
              <option key={a.id} value={a.id}>
                {annotationMeta(a.type).short} {formatTime(a.timestampSec)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Entry cue</label>
          <select className={inputCls} value={entryCueId} onChange={(e) => setEntryCueId(e.target.value)}>
            <option value="">—</option>
            {toAnns.map((a) => (
              <option key={a.id} value={a.id}>
                {annotationMeta(a.type).short} {formatTime(a.timestampSec)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className={labelCls + ' mb-0'}>Rating</label>
        <RatingInput value={rating} onChange={setRating} />
      </div>
      <div className="flex justify-end gap-2">
        <button className={btn.ghost} onClick={onDone}>
          Cancel
        </button>
        <button className={btn.primary} onClick={save}>
          Save
        </button>
      </div>
    </div>
  )
}
