import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateEdge, deleteEdge } from '../../db/db'
import type { Annotation, Edge, Track } from '../../types'
import { annotationMeta } from '../../lib/music'
import { formatTime } from '../../lib/time'
import { Modal, RatingInput, TagInput, btn, inputCls, labelCls } from '../common/widgets'

export function EdgeEditModal({ edgeId, onClose }: { edgeId: string; onClose: () => void }) {
  const edge = useLiveQuery(() => db.edges.get(edgeId), [edgeId])
  const tracks = useLiveQuery(() => db.tracks.toArray(), [])
  const fromAnns = useLiveQuery(
    () => db.annotations.where('trackId').equals(edge?.fromTrackId ?? '').toArray(),
    [edge?.fromTrackId],
  )
  const toAnns = useLiveQuery(
    () => db.annotations.where('trackId').equals(edge?.toTrackId ?? '').toArray(),
    [edge?.toTrackId],
  )
  const trackById = useMemo(() => new Map((tracks ?? []).map((t) => [t.id, t])), [tracks])

  return (
    <Modal open onClose={onClose} title="Edit transition" maxW="max-w-md">
      {!edge ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <EdgeForm
          key={edge.id}
          edge={edge}
          from={trackById.get(edge.fromTrackId)}
          to={trackById.get(edge.toTrackId)}
          fromAnns={fromAnns ?? []}
          toAnns={toAnns ?? []}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function EdgeForm({
  edge,
  from,
  to,
  fromAnns,
  toAnns,
  onClose,
}: {
  edge: Edge
  from?: Track
  to?: Track
  fromAnns: Annotation[]
  toAnns: Annotation[]
  onClose: () => void
}) {
  const [technique, setTechnique] = useState(edge.technique ?? '')
  const [tags, setTags] = useState<string[]>(edge.tags ?? [])
  const [rating, setRating] = useState<number | undefined>(edge.rating)
  const [exitCueId, setExitCueId] = useState(edge.exitCueId ?? '')
  const [entryCueId, setEntryCueId] = useState(edge.entryCueId ?? '')

  const sortAnns = (a: Annotation[]) => [...a].sort((x, y) => x.timestampSec - y.timestampSec)

  const save = async () => {
    await updateEdge(edge.id, {
      technique: technique.trim() || undefined,
      tags,
      rating,
      exitCueId: exitCueId || undefined,
      entryCueId: entryCueId || undefined,
    })
    onClose()
  }
  const del = async () => {
    if (confirm('Delete this transition?')) {
      await deleteEdge(edge.id)
      onClose()
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-200">
        {from?.title ?? '(deleted)'} <span className="text-accent">→</span> {to?.title ?? '(deleted)'}
      </div>

      <input
        className={inputCls}
        value={technique}
        onChange={(e) => setTechnique(e.target.value)}
        placeholder="Technique (e.g. bass swap on the drop)"
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
            {sortAnns(fromAnns).map((a) => (
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
            {sortAnns(toAnns).map((a) => (
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

      <div className="flex items-center justify-between pt-1">
        <button className="text-xs text-zinc-500 hover:text-rose-400" onClick={() => void del()}>
          Delete transition
        </button>
        <div className="flex gap-2">
          <button className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
