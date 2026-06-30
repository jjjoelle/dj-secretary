import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addEdge } from '../../db/db'
import type { Track } from '../../types'
import { annotationMeta } from '../../lib/music'
import { formatTime } from '../../lib/time'
import { Modal, RatingInput, TagInput, btn, inputCls, labelCls } from '../common/widgets'

type Direction = 'out' | 'in'

export function AddTransitionModal({
  open,
  onClose,
  sourceTrack,
  allTracks,
}: {
  open: boolean
  onClose: () => void
  sourceTrack: Track
  allTracks: Track[]
}) {
  const [direction, setDirection] = useState<Direction>('out')
  const [otherId, setOtherId] = useState('')
  const [technique, setTechnique] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [rating, setRating] = useState<number | undefined>(undefined)
  const [exitCueId, setExitCueId] = useState('')
  const [entryCueId, setEntryCueId] = useState('')

  useEffect(() => {
    if (open) {
      setDirection('out')
      setOtherId('')
      setTechnique('')
      setTags([])
      setRating(undefined)
      setExitCueId('')
      setEntryCueId('')
    }
  }, [open])

  const sourceAnns = useLiveQuery(
    () => db.annotations.where('trackId').equals(sourceTrack.id).toArray(),
    [sourceTrack.id],
  )
  // equals('') returns [] when no track is chosen yet — keeps a single return type.
  const otherAnns = useLiveQuery(
    () => db.annotations.where('trackId').equals(otherId).toArray(),
    [otherId],
  )

  const others = useMemo(
    () => allTracks.filter((t) => t.id !== sourceTrack.id).sort((a, b) => a.title.localeCompare(b.title)),
    [allTracks, sourceTrack.id],
  )

  // from/to and which annotations feed the exit vs entry cue selectors.
  const fromAnns = direction === 'out' ? sourceAnns : otherAnns
  const toAnns = direction === 'out' ? otherAnns : sourceAnns

  const save = async () => {
    if (!otherId) return
    const fromTrackId = direction === 'out' ? sourceTrack.id : otherId
    const toTrackId = direction === 'out' ? otherId : sourceTrack.id
    await addEdge({
      fromTrackId,
      toTrackId,
      exitCueId: exitCueId || undefined,
      entryCueId: entryCueId || undefined,
      technique: technique.trim() || undefined,
      tags,
      rating,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add transition" maxW="max-w-md">
      <div className="space-y-3">
        <div className="flex rounded-md border border-edge bg-ink p-0.5 text-sm">
          <button
            className={`flex-1 rounded px-2 py-1.5 ${direction === 'out' ? 'bg-accent text-white' : 'text-zinc-300'}`}
            onClick={() => setDirection('out')}
          >
            {sourceTrack.title} →
          </button>
          <button
            className={`flex-1 rounded px-2 py-1.5 ${direction === 'in' ? 'bg-accent text-white' : 'text-zinc-300'}`}
            onClick={() => setDirection('in')}
          >
            → {sourceTrack.title}
          </button>
        </div>

        <div>
          <label className={labelCls}>{direction === 'out' ? 'Mixes into' : 'Mixes in from'}</label>
          <select className={inputCls} value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            <option value="">Select a track…</option>
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.artist}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CueSelect
            label="Exit cue (from-track)"
            value={exitCueId}
            onChange={setExitCueId}
            anns={fromAnns ?? []}
          />
          <CueSelect
            label="Entry cue (to-track)"
            value={entryCueId}
            onChange={setEntryCueId}
            anns={toAnns ?? []}
          />
        </div>

        <div>
          <label className={labelCls}>Technique</label>
          <input
            className={inputCls}
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            placeholder="e.g. bass swap on the drop"
          />
        </div>

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

        <div className="flex items-center gap-3">
          <label className={labelCls + ' mb-0'}>Rating</label>
          <RatingInput value={rating} onChange={setRating} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button className={btn.primary} onClick={save} disabled={!otherId}>
            Add transition
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CueSelect({
  label,
  value,
  onChange,
  anns,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  anns: { id: string; type: import('../../types').AnnotationType; timestampSec: number }[]
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {anns.map((a) => (
          <option key={a.id} value={a.id}>
            {annotationMeta(a.type).short} {formatTime(a.timestampSec)}
          </option>
        ))}
      </select>
    </div>
  )
}
