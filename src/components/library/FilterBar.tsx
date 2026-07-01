import { useMemo, useState } from 'react'
import type { FilterQuery, TagMode, Track } from '../../types'
import { CAMELOT_KEYS } from '../../lib/music'
import { formatTime, parseTime } from '../../lib/time'

// A structured, multi-dimension filter over the open collection. Writes into a
// single FilterQuery so the same shape can be saved as a Smart Crate. Pure
// filter UI — membership + ranges only, no mixability/recommendation.
export function FilterBar({
  query,
  onChange,
  tracks,
  rightSlot,
}: {
  query: FilterQuery
  onChange: (q: FilterQuery) => void
  tracks: Track[]
  rightSlot?: React.ReactNode // e.g. a "Save as crate" button
}) {
  const [open, setOpen] = useState(false)

  const opts = useMemo(() => deriveOptions(tracks), [tracks])
  const mode: TagMode = query.tagMode ?? 'all'
  const set = (patch: Partial<FilterQuery>) => onChange({ ...query, ...patch })
  const num = (v: string): number | undefined => {
    const n = Number(v)
    return v.trim() === '' || Number.isNaN(n) ? undefined : n
  }

  const chips = activeChips(query, onChange)

  return (
    <div className="border-b border-edge px-4 py-2">
      {/* Row 1: label, active summary chips, expand toggle, right slot, clear. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wide text-zinc-500">Filter</span>
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={c.clear}
            className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-violet-100 hover:bg-accent/30"
            title="Remove filter"
          >
            {c.label}
            <span className="text-violet-300/70">×</span>
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`rounded-full border border-edge px-2 py-0.5 text-xs transition ${
            open ? 'bg-panel2 text-zinc-200' : 'text-zinc-400 hover:bg-panel2'
          }`}
        >
          {open ? '− Filters' : '+ Filter'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {rightSlot}
          {chips.length > 0 && (
            <button onClick={() => onChange({})} className="text-xs text-zinc-500 hover:text-zinc-200">
              clear all
            </button>
          )}
        </div>
      </div>

      {/* Row 2: the builder (collapsible). */}
      {open && (
        <div className="mt-2 flex flex-col gap-3 rounded-md border border-edge bg-ink/60 p-3">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <RangeGroup
              label="BPM"
              minVal={query.bpmMin}
              maxVal={query.bpmMax}
              onMin={(v) => set({ bpmMin: num(v) })}
              onMax={(v) => set({ bpmMax: num(v) })}
            />
            <RangeGroup
              label="Energy"
              minVal={query.energyMin}
              maxVal={query.energyMax}
              onMin={(v) => set({ energyMin: num(v) })}
              onMax={(v) => set({ energyMax: num(v) })}
              inputMin={1}
              inputMax={10}
            />
            <DurationGroup
              minVal={query.durationMin}
              maxVal={query.durationMax}
              onMin={(v) => set({ durationMin: v })}
              onMax={(v) => set({ durationMax: v })}
            />
          </div>

          {opts.keys.length > 0 && (
            <PillGroup
              label="Key"
              options={opts.keys}
              selected={query.keys ?? []}
              onToggle={(v) => set({ keys: toggleIn(query.keys, v) })}
            />
          )}
          {opts.genres.length > 0 && (
            <PillGroup
              label="Genre"
              options={opts.genres}
              selected={query.genres ?? []}
              onToggle={(v) => set({ genres: toggleIn(query.genres, v) })}
            />
          )}
          {opts.artists.length > 0 && (
            <PillGroup
              label="Artist"
              options={opts.artists}
              selected={query.artists ?? []}
              onToggle={(v) => set({ artists: toggleIn(query.artists, v) })}
            />
          )}
          {opts.tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Tags</span>
                <Segmented mode={mode} onChange={(m) => set({ tagMode: m })} />
              </div>
              <div className="flex flex-wrap gap-1">
                {opts.tags.map((tag) => {
                  const on = (query.includeTags ?? []).includes(tag)
                  return (
                    <Pill key={tag} on={on} onClick={() => set({ includeTags: toggleIn(query.includeTags, tag) })}>
                      #{tag}
                    </Pill>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- helpers ----

function deriveOptions(tracks: Track[]) {
  const tags = new Set<string>()
  const genres = new Set<string>()
  const artists = new Set<string>()
  const keys = new Set<string>()
  tracks.forEach((t) => {
    t.tags.forEach((x) => tags.add(x))
    if (t.genre) genres.add(t.genre)
    if (t.artist) artists.add(t.artist)
    if (t.key) keys.add(t.key)
  })
  const sortedKeys = [...keys].sort((a, b) => {
    const ia = CAMELOT_KEYS.indexOf(a)
    const ib = CAMELOT_KEYS.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return {
    tags: [...tags].sort(),
    genres: [...genres].sort(),
    artists: [...artists].sort(),
    keys: sortedKeys,
  }
}

function toggleIn(arr: string[] | undefined, v: string): string[] {
  const a = arr ?? []
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v]
}

function rangeLabel(min?: number, max?: number, fmt: (n: number) => string = String): string {
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`
  if (min != null) return `≥${fmt(min)}`
  return `≤${fmt(max as number)}`
}

function activeChips(q: FilterQuery, onChange: (q: FilterQuery) => void): { label: string; clear: () => void }[] {
  const chips: { label: string; clear: () => void }[] = []
  if (q.bpmMin != null || q.bpmMax != null)
    chips.push({ label: `BPM ${rangeLabel(q.bpmMin, q.bpmMax)}`, clear: () => onChange({ ...q, bpmMin: undefined, bpmMax: undefined }) })
  if (q.energyMin != null || q.energyMax != null)
    chips.push({ label: `Energy ${rangeLabel(q.energyMin, q.energyMax)}`, clear: () => onChange({ ...q, energyMin: undefined, energyMax: undefined }) })
  if (q.durationMin != null || q.durationMax != null)
    chips.push({ label: `Time ${rangeLabel(q.durationMin, q.durationMax, formatTime)}`, clear: () => onChange({ ...q, durationMin: undefined, durationMax: undefined }) })
  if (q.keys?.length) chips.push({ label: `Key: ${q.keys.join(', ')}`, clear: () => onChange({ ...q, keys: undefined }) })
  if (q.genres?.length) chips.push({ label: `Genre: ${q.genres.join(', ')}`, clear: () => onChange({ ...q, genres: undefined }) })
  if (q.artists?.length) chips.push({ label: `Artist: ${q.artists.join(', ')}`, clear: () => onChange({ ...q, artists: undefined }) })
  if (q.includeTags?.length)
    chips.push({ label: `tags ${q.tagMode ?? 'all'}: ${q.includeTags.join(', ')}`, clear: () => onChange({ ...q, includeTags: undefined }) })
  if (q.excludeTags?.length)
    chips.push({ label: `not: ${q.excludeTags.join(', ')}`, clear: () => onChange({ ...q, excludeTags: undefined }) })
  return chips
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-xs transition ${
        on ? 'bg-accent text-white' : 'bg-panel2 text-zinc-300 hover:bg-edge'
      }`}
    >
      {children}
    </button>
  )
}

function PillGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <Pill key={o} on={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Pill>
        ))}
      </div>
    </div>
  )
}

function Segmented({ mode, onChange }: { mode: TagMode; onChange: (m: TagMode) => void }) {
  const MODES: { v: TagMode; label: string }[] = [
    { v: 'all', label: 'All' },
    { v: 'any', label: 'Any' },
    { v: 'none', label: 'None' },
  ]
  return (
    <div className="flex rounded-md border border-edge bg-ink p-0.5">
      {MODES.map((m) => (
        <button
          key={m.v}
          onClick={() => onChange(m.v)}
          className={`rounded px-2 py-0.5 text-xs transition ${
            mode === m.v ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title={m.v === 'all' ? 'Has all selected tags' : m.v === 'any' ? 'Has any selected tag' : 'Has none of the selected tags'}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

const rangeInputCls =
  'w-16 rounded border border-edge bg-ink px-1.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none'

function RangeGroup({
  label,
  minVal,
  maxVal,
  onMin,
  onMax,
  inputMin,
  inputMax,
}: {
  label: string
  minVal?: number
  maxVal?: number
  onMin: (v: string) => void
  onMax: (v: string) => void
  inputMin?: number
  inputMax?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={inputMin}
          max={inputMax}
          value={minVal ?? ''}
          onChange={(e) => onMin(e.target.value)}
          placeholder="min"
          className={rangeInputCls}
        />
        <span className="text-zinc-600">–</span>
        <input
          type="number"
          min={inputMin}
          max={inputMax}
          value={maxVal ?? ''}
          onChange={(e) => onMax(e.target.value)}
          placeholder="max"
          className={rangeInputCls}
        />
      </div>
    </div>
  )
}

// Duration takes m:ss text; we keep a local draft and commit parsed seconds on
// blur/Enter so partial input ("3:") doesn't get clobbered mid-type.
function DurationGroup({
  minVal,
  maxVal,
  onMin,
  onMax,
}: {
  minVal?: number
  maxVal?: number
  onMin: (v: number | undefined) => void
  onMax: (v: number | undefined) => void
}) {
  const [draftMin, setDraftMin] = useState<string | null>(null)
  const [draftMax, setDraftMax] = useState<string | null>(null)
  const display = (v?: number) => (v != null ? formatTime(v) : '')
  const commit = (text: string, apply: (v: number | undefined) => void) => {
    apply(text.trim() === '' ? undefined : (parseTime(text) ?? undefined))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">Time</span>
      <div className="flex items-center gap-1">
        <input
          value={draftMin ?? display(minVal)}
          onChange={(e) => setDraftMin(e.target.value)}
          onBlur={() => {
            if (draftMin != null) commit(draftMin, onMin)
            setDraftMin(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          placeholder="0:00"
          className={rangeInputCls}
        />
        <span className="text-zinc-600">–</span>
        <input
          value={draftMax ?? display(maxVal)}
          onChange={(e) => setDraftMax(e.target.value)}
          onBlur={() => {
            if (draftMax != null) commit(draftMax, onMax)
            setDraftMax(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          placeholder="9:99"
          className={rangeInputCls}
        />
      </div>
    </div>
  )
}
