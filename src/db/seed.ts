import { db, newId } from './db'
import type { Track, Annotation, Edge } from '../types'

// Seed a small starter graph the first time the app runs, so the library and
// graph views aren't empty. Only runs when the tracks table is empty.
// The module-level promise guard makes this safe under React StrictMode, which
// invokes the mount effect twice in dev — otherwise both calls race past the
// empty-table check and seed twice.
let seedPromise: Promise<void> | null = null
export function seedIfEmpty(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed()
  return seedPromise
}

async function doSeed(): Promise<void> {
  const count = await db.tracks.count()
  if (count > 0) return

  const now = Date.now()
  const mk = (
    title: string,
    artist: string,
    durationSec: number,
    bpm: number,
    key: string,
    genre: string,
    energy: number,
    tags: string[],
  ): Track => ({
    id: newId(),
    title,
    artist,
    durationSec,
    bpm,
    key,
    genre,
    energy,
    tags,
    createdAt: now,
  })

  const opus = mk('Opus', 'Eric Prydz', 544, 126, '8A', 'Progressive House', 7, ['peak', 'progressive'])
  const strobe = mk('Strobe', 'deadmau5', 633, 128, '4A', 'Progressive House', 6, ['journey', 'progressive'])
  const innerbloom = mk('Innerbloom', 'RÜFÜS DU SOL', 578, 120, '11A', 'Melodic House', 5, ['warmup', 'melodic'])
  const youAndMe = mk('You & Me (Flume Remix)', 'Disclosure', 263, 124, '9A', 'Future Garage', 6, ['vocal'])
  const adagio = mk('Adagio for Strings', 'Tiësto', 480, 138, '12B', 'Trance', 8, ['peak', 'trance'])

  const tracks = [opus, strobe, innerbloom, youAndMe, adagio]

  const annotations: Annotation[] = [
    { id: newId(), trackId: opus.id, timestampSec: 32, type: 'cue_in', text: 'Beatless intro — bring in over a breakdown' },
    { id: newId(), trackId: opus.id, timestampSec: 196, type: 'motif_start', text: 'The build everyone waits for' },
    { id: newId(), trackId: opus.id, timestampSec: 480, type: 'cue_out', text: 'Long outro, easy to mix out' },
    { id: newId(), trackId: strobe.id, timestampSec: 0, type: 'cue_in', text: 'Ambient piano intro' },
    { id: newId(), trackId: strobe.id, timestampSec: 540, type: 'eq', text: 'Kill lows, let the pad breathe', eq: { low: true, mid: false, high: false } },
    { id: newId(), trackId: innerbloom.id, timestampSec: 90, type: 'cue_in', text: 'Drop the kick in here' },
  ]

  const opusOut = annotations.find((a) => a.trackId === opus.id && a.type === 'cue_out')!
  const strobeIn = annotations.find((a) => a.trackId === strobe.id && a.type === 'cue_in')!
  const innerbloomIn = annotations.find((a) => a.trackId === innerbloom.id && a.type === 'cue_in')!

  const edges: Edge[] = [
    {
      id: newId(),
      fromTrackId: opus.id,
      toTrackId: strobe.id,
      exitCueId: opusOut.id,
      entryCueId: strobeIn.id,
      technique: 'Bass swap on the Opus outro into the Strobe intro',
      tags: ['bass swap'],
      rating: 5,
      createdAt: now,
    },
    {
      id: newId(),
      fromTrackId: strobe.id,
      toTrackId: innerbloom.id,
      entryCueId: innerbloomIn.id,
      technique: 'Long echo-out, drop the kick on the 16',
      tags: [],
      rating: 4,
      createdAt: now,
    },
    {
      id: newId(),
      fromTrackId: innerbloom.id,
      toTrackId: opus.id,
      technique: 'Filter sweep up, energy lift back to peak',
      tags: ['?'],
      rating: 3,
      createdAt: now,
    },
  ]

  await db.transaction('rw', db.tracks, db.annotations, db.edges, async () => {
    await db.tracks.bulkAdd(tracks)
    await db.annotations.bulkAdd(annotations)
    await db.edges.bulkAdd(edges)
  })
}
