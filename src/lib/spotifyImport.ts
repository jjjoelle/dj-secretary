import { db, createTrack, createPlaylist, updatePlaylist, createSet, updateSet } from '../db/db'
import type { SpotifyTrackResult } from './spotify'

// One-way import of Spotify tracks into the local library, deduped on spotifyId
// (spotifyId isn't indexed, so we scan once per batch). The two libraries stay
// separate — this only copies metadata in.
export async function importSpotifyTracks(
  results: SpotifyTrackResult[],
): Promise<{ ids: string[]; added: number }> {
  const existing = await db.tracks.toArray()
  const bySpotify = new Map<string, string>()
  existing.forEach((t) => {
    if (t.spotifyId) bySpotify.set(t.spotifyId, t.id)
  })

  const ids: string[] = []
  let added = 0
  for (const r of results) {
    const have = bySpotify.get(r.spotifyId)
    if (have) {
      ids.push(have)
      continue
    }
    const id = await createTrack({
      title: r.title,
      artist: r.artist,
      durationSec: r.durationSec,
      spotifyId: r.spotifyId,
      albumArtUrl: r.albumArtUrl,
      tags: [],
    })
    bySpotify.set(r.spotifyId, id)
    ids.push(id)
    added++
  }
  return { ids, added }
}

export async function importSpotifyTrack(r: SpotifyTrackResult): Promise<{ id: string; added: boolean }> {
  const { ids, added } = await importSpotifyTracks([r])
  return { id: ids[0], added: added > 0 }
}

// Import a Spotify playlist as a local playlist or set (tracks deduped first).
export async function importSpotifyPlaylist(
  name: string,
  tracks: SpotifyTrackResult[],
  as: 'playlist' | 'set',
): Promise<{ added: number; total: number }> {
  const { ids, added } = await importSpotifyTracks(tracks)
  if (as === 'set') {
    const id = await createSet(name)
    await updateSet(id, { trackIds: ids })
  } else {
    const id = await createPlaylist(name)
    await updatePlaylist(id, { trackIds: ids })
  }
  return { added, total: ids.length }
}
