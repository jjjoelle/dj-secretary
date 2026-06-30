import type { AnnotationType } from '../types'

export interface AnnotationTypeMeta {
  type: AnnotationType
  label: string
  short: string
  color: string
}

// Visual + label metadata for each annotation kind. Colors are used on the
// timeline markers and chips.
export const ANNOTATION_TYPES: AnnotationTypeMeta[] = [
  { type: 'cue_in', label: 'Cue in', short: 'IN', color: '#34d399' },
  { type: 'cue_out', label: 'Cue out', short: 'OUT', color: '#fb7185' },
  { type: 'motif_start', label: 'Motif start', short: 'M▶', color: '#fbbf24' },
  { type: 'motif_stop', label: 'Motif stop', short: 'M■', color: '#f59e0b' },
  { type: 'eq', label: 'EQ', short: 'EQ', color: '#38bdf8' },
  { type: 'filter', label: 'Filter', short: 'FLT', color: '#e879f9' },
  { type: 'custom', label: 'Note', short: '•', color: '#a1a1aa' },
]

const ANNOTATION_BY_TYPE: Record<AnnotationType, AnnotationTypeMeta> = Object.fromEntries(
  ANNOTATION_TYPES.map((m) => [m.type, m]),
) as Record<AnnotationType, AnnotationTypeMeta>

export function annotationMeta(type: AnnotationType): AnnotationTypeMeta {
  return ANNOTATION_BY_TYPE[type]
}

// Camelot wheel keys, for the (optional) key dropdown. Not used for any
// auto-suggest yet — just a tidy way to enter a track's key.
export const CAMELOT_KEYS: string[] = (() => {
  const keys: string[] = []
  for (let n = 1; n <= 12; n++) {
    keys.push(`${n}A`)
    keys.push(`${n}B`)
  }
  return keys
})()
