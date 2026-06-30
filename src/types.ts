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
  createdAt: number
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
  createdAt: number
}
