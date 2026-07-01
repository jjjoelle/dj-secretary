// Core domain types for DJ Secretary.
// These are intentionally storage-friendly (plain JSON) so the whole DB can be
// exported/imported as JSON and so a future set-generator can consume edges directly.

export type AnnotationType =
  | 'cue_in'
  | 'cue_out'
  | 'motif_start'
  | 'motif_stop'
  | 'eq'
  | 'filter'
  | 'custom'

export interface EqEmphasis {
  low: boolean
  mid: boolean
  high: boolean
}

export interface Track {
  id: string
  title: string
  artist: string
  durationSec?: number
  bpm?: number
  key?: string // Camelot (e.g. "8A") or free text — manual, Spotify no longer provides it
  genre?: string
  energy?: number // 1-10
  tags: string[]
  notes?: string
  spotifyId?: string
  albumArtUrl?: string
  position?: { x: number; y: number } // persisted graph position
  createdAt: number
}

export interface Annotation {
  id: string
  trackId: string
  timestampSec: number
  type: AnnotationType
  text?: string
  eq?: EqEmphasis // only meaningful for type === 'eq'
}

// A directed transition: you mix OUT of `fromTrack` INTO `toTrack`.
// Navigable from both endpoints, but the technique itself is one-way.
export interface Edge {
  id: string
  fromTrackId: string
  toTrackId: string
  exitCueId?: string // annotation id on the from-track
  entryCueId?: string // annotation id on the to-track
  technique?: string // free-text label/description of the transition
  tags: string[] // structured quick tags (e.g. "?", "bass swap", "key clash")
  rating?: number // 1-5
  createdAt: number
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  folderId?: string // undefined = top-level (ungrouped)
  createdAt: number
}

// Groups playlists OR sets in the sidebar. `kind` discriminates which section it
// belongs to. Membership lives on the item (Playlist/TrackSet.folderId), not
// here — so there's no child list to keep in sync. Portable (backed up).
export interface Folder {
  id: string
  name: string
  kind: 'playlist' | 'set'
  createdAt: number
}

// Small key/value store for app-local settings (e.g. the auto-backup file handle).
export interface Meta {
  key: string
  value: unknown
}

// A local recovery snapshot: a full-DB JSON blob, ring-buffered. Local only —
// NOT part of the portable JSON backup.
export interface Snapshot {
  id: string
  createdAt: number
  label?: string
  json: string
}

// A Set is an ordered *route* through the transition graph. Same storage as a
// playlist, but rendered as a path: the transition between each consecutive
// pair is pulled from the edges, and gaps with no vetted transition are flagged.
// (Named TrackSet to avoid clashing with the built-in Set.)
export interface TrackSet {
  id: string
  name: string
  trackIds: string[]
  folderId?: string // undefined = top-level (ungrouped)
  createdAt: number
}

// ---- FilterQuery: a serializable, declarative filter over the track library. ----
// Used live by the CollectionView filter bar AND stored verbatim in a SmartCrate.
// PRODUCT NOTE: this is a pure FILTER (show the tracks I pick), never a
// recommender. Membership/range only — no Camelot-distance / "what mixes next".
export type TagMode = 'all' | 'any' | 'none' // AND / OR / NOT, applied to includeTags

export interface FilterQuery {
  text?: string // free-text over title/artist/genre/tags
  includeTags?: string[] // combined per tagMode
  excludeTags?: string[] // always NOT (a track with any of these is excluded)
  tagMode?: TagMode // default 'all'
  bpmMin?: number // inclusive; undefined = unbounded
  bpmMax?: number
  energyMin?: number // 1-10
  energyMax?: number
  durationMin?: number // seconds
  durationMax?: number
  keys?: string[] // membership (NOT harmonic matching)
  genres?: string[] // membership
  artists?: string[] // membership
}

// Device-local track-table column preferences. Persisted in the `meta` table
// (key 'ui.trackColumns'); NOT part of the portable backup. Unknown ids are
// ignored on read so the layout survives columns being added/removed in code.
export interface ColumnConfig {
  order: string[] // column ids in display order
  hidden: string[] // column ids to hide
}

// A saved FilterQuery, shown in the sidebar and re-evaluated live against the
// library (so its match count stays current). Portable, user-authored data —
// included in the JSON backup.
export interface SmartCrate {
  id: string
  name: string
  query: FilterQuery
  createdAt: number
}
