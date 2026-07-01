import type { Track, FilterQuery } from '../types'

// Pure, serializable filtering over the track library. Mirrors lib/edges.ts:
// an empty dimension is a pass-through, so an empty query matches everything.
// No DB import, no Camelot-distance / mixability logic — membership + ranges only.

export function emptyQuery(): FilterQuery {
  return {}
}

export function isQueryActive(q: FilterQuery): boolean {
  return Boolean(
    (q.text && q.text.trim()) ||
      q.includeTags?.length ||
      q.excludeTags?.length ||
      q.bpmMin != null ||
      q.bpmMax != null ||
      q.energyMin != null ||
      q.energyMax != null ||
      q.durationMin != null ||
      q.durationMax != null ||
      q.keys?.length ||
      q.genres?.length ||
      q.artists?.length,
  )
}

export function allTrackTags(tracks: Track[]): string[] {
  const set = new Set<string>()
  tracks.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
  return [...set].sort()
}

// A bounded range excludes a track whose value is missing — "BPM ≥ 120" can't
// include a track with no BPM. An unbounded side imposes no constraint.
function inRange(v: number | undefined, min?: number, max?: number): boolean {
  if (min != null && (v == null || v < min)) return false
  if (max != null && (v == null || v > max)) return false
  return true
}

export function matchesQuery(t: Track, q: FilterQuery): boolean {
  if (q.text && q.text.trim()) {
    const s = q.text.trim().toLowerCase()
    const hit =
      t.title.toLowerCase().includes(s) ||
      t.artist.toLowerCase().includes(s) ||
      (t.genre ?? '').toLowerCase().includes(s) ||
      t.tags.some((tag) => tag.toLowerCase().includes(s))
    if (!hit) return false
  }

  const inc = q.includeTags ?? []
  if (inc.length) {
    const mode = q.tagMode ?? 'all'
    if (mode === 'all' && !inc.every((tag) => t.tags.includes(tag))) return false
    if (mode === 'any' && !inc.some((tag) => t.tags.includes(tag))) return false
    if (mode === 'none' && inc.some((tag) => t.tags.includes(tag))) return false
  }
  if ((q.excludeTags ?? []).some((tag) => t.tags.includes(tag))) return false

  if (!inRange(t.bpm, q.bpmMin, q.bpmMax)) return false
  if (!inRange(t.energy, q.energyMin, q.energyMax)) return false
  if (!inRange(t.durationSec, q.durationMin, q.durationMax)) return false

  if (q.keys?.length && !(t.key && q.keys.includes(t.key))) return false
  if (q.genres?.length && !(t.genre && q.genres.includes(t.genre))) return false
  if (q.artists?.length && !q.artists.includes(t.artist)) return false

  return true
}

export function filterTracks(tracks: Track[], q: FilterQuery): Track[] {
  if (!isQueryActive(q)) return tracks
  return tracks.filter((t) => matchesQuery(t, q))
}

// A canonical string for a query: stable field order, sorted arrays, empties
// dropped. Used to tell whether a live query differs from a saved crate's
// (Save-as-new vs Update), regardless of how the object was assembled.
export function canonicalQuery(q: FilterQuery): string {
  const o: Record<string, unknown> = {}
  const arr = (a?: string[]) => (a && a.length ? [...a].sort() : undefined)
  if (q.text?.trim()) o.text = q.text.trim()
  if (q.includeTags?.length) {
    o.includeTags = arr(q.includeTags)
    o.tagMode = q.tagMode ?? 'all'
  }
  if (q.excludeTags?.length) o.excludeTags = arr(q.excludeTags)
  for (const k of ['bpmMin', 'bpmMax', 'energyMin', 'energyMax', 'durationMin', 'durationMax'] as const) {
    if (q[k] != null) o[k] = q[k]
  }
  if (q.keys?.length) o.keys = arr(q.keys)
  if (q.genres?.length) o.genres = arr(q.genres)
  if (q.artists?.length) o.artists = arr(q.artists)
  return JSON.stringify(o)
}
