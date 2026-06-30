import { useRef, useState } from 'react'
import type { Annotation, AnnotationType, EqEmphasis } from '../../types'
import { ANNOTATION_TYPES, annotationMeta } from '../../lib/music'
import { formatTime, parseTime } from '../../lib/time'
import { addAnnotation, updateAnnotation, deleteAnnotation } from '../../db/db'
import { btn, inputCls } from '../common/widgets'

export function AnnotationTimeline({
  trackId,
  durationSec,
  annotations,
}: {
  trackId: string
  durationSec?: number
  annotations: Annotation[]
}) {
  const [draft, setDraft] = useState<{ initial: Annotation | null; time: number } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const sorted = [...annotations].sort((a, b) => a.timestampSec - b.timestampSec)

  const onBarClick = (e: React.MouseEvent) => {
    if (!durationSec || !barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setDraft({ initial: null, time: Math.round(ratio * durationSec) })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Annotations</h3>
        <button className={btn.ghost} onClick={() => setDraft({ initial: null, time: 0 })}>
          + Add
        </button>
      </div>

      {durationSec ? (
        <div
          ref={barRef}
          onClick={onBarClick}
          className="relative h-9 cursor-crosshair rounded-md border border-edge bg-ink"
          title="Click to add an annotation here"
        >
          {sorted.map((a) => {
            const meta = annotationMeta(a.type)
            const left = `${Math.min(100, (a.timestampSec / durationSec) * 100)}%`
            return (
              <button
                key={a.id}
                className="absolute top-0 h-full w-0.5 -translate-x-1/2"
                style={{ left, background: meta.color }}
                title={`${meta.label} @ ${formatTime(a.timestampSec)}${a.text ? ` — ${a.text}` : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setDraft({ initial: a, time: a.timestampSec })
                }}
              >
                <span
                  className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
                  style={{ background: meta.color }}
                />
              </button>
            )
          })}
        </div>
      ) : (
        <p className="rounded-md border border-edge bg-panel2 px-2.5 py-1.5 text-xs text-zinc-500">
          Set a duration on the track to place annotations on a timeline. You can still add them below.
        </p>
      )}

      {draft && (
        <AnnotationEditor
          trackId={trackId}
          initial={draft.initial}
          defaultTime={draft.time}
          onDone={() => setDraft(null)}
        />
      )}

      <ul className="space-y-1">
        {sorted.map((a) => {
          const meta = annotationMeta(a.type)
          return (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-edge bg-panel2 px-2 py-1.5"
            >
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.short}
              </span>
              <span className="font-mono text-xs text-zinc-300">{formatTime(a.timestampSec)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                {a.text || <span className="text-zinc-500">{meta.label}</span>}
                {a.type === 'eq' && a.eq && (
                  <span className="ml-1 text-sky-300">
                    [{[a.eq.low && 'low', a.eq.mid && 'mid', a.eq.high && 'high'].filter(Boolean).join(' ') || 'none'}]
                  </span>
                )}
              </span>
              <button
                className="text-xs text-zinc-500 hover:text-zinc-200"
                onClick={() => setDraft({ initial: a, time: a.timestampSec })}
              >
                edit
              </button>
              <button
                className="text-xs text-zinc-500 hover:text-rose-400"
                onClick={() => void deleteAnnotation(a.id)}
              >
                ✕
              </button>
            </li>
          )
        })}
        {sorted.length === 0 && !draft && (
          <li className="px-1 py-2 text-xs text-zinc-500">No annotations yet.</li>
        )}
      </ul>
    </section>
  )
}

function AnnotationEditor({
  trackId,
  initial,
  defaultTime,
  onDone,
}: {
  trackId: string
  initial: Annotation | null
  defaultTime: number
  onDone: () => void
}) {
  const [type, setType] = useState<AnnotationType>(initial?.type ?? 'cue_in')
  const [timeText, setTimeText] = useState(formatTime(initial?.timestampSec ?? defaultTime))
  const [text, setText] = useState(initial?.text ?? '')
  const [eq, setEq] = useState<EqEmphasis>(initial?.eq ?? { low: false, mid: false, high: false })

  const save = async () => {
    const timestampSec = parseTime(timeText) ?? 0
    const base = {
      trackId,
      timestampSec,
      type,
      text: text.trim() || undefined,
      eq: type === 'eq' ? eq : undefined,
    }
    if (initial) await updateAnnotation(initial.id, base)
    else await addAnnotation(base)
    onDone()
  }

  return (
    <div className="space-y-2 rounded-md border border-accent/40 bg-panel2 p-2.5">
      <div className="flex gap-2">
        <select
          className={`${inputCls} w-auto`}
          value={type}
          onChange={(e) => setType(e.target.value as AnnotationType)}
        >
          {ANNOTATION_TYPES.map((m) => (
            <option key={m.type} value={m.type}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          className={`${inputCls} w-24`}
          value={timeText}
          onChange={(e) => setTimeText(e.target.value)}
          placeholder="m:ss"
        />
      </div>
      <input
        className={inputCls}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Note (e.g. 'bring in over the breakdown')"
        autoFocus
      />
      {type === 'eq' && (
        <div className="flex gap-3 text-xs text-zinc-300">
          {(['low', 'mid', 'high'] as const).map((band) => (
            <label key={band} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={eq[band]}
                onChange={(e) => setEq((p) => ({ ...p, [band]: e.target.checked }))}
              />
              {band}
            </label>
          ))}
          <span className="text-zinc-500">(what's emphasized / isolated)</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button className={btn.ghost} onClick={onDone}>
          Cancel
        </button>
        <button className={btn.primary} onClick={save}>
          {initial ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  )
}
