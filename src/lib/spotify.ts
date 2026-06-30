// Spotify Web API integration via Authorization Code + PKCE (public client, no
// secret) so the app stays entirely client-side. We only use the `search`
// endpoint, which needs no user scopes.
//
// NOTE: Spotify removed audio-features (BPM / key / energy) from its API for
// newly-registered apps, so we only pull title / artist / duration / art / id.
// Everything else is entered manually.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const TOKEN_KEY = 'dj-secretary.spotifyToken'
const VERIFIER_KEY = 'dj-secretary.pkceVerifier'
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
// Read scopes for the "My Spotify" page (search itself needs none).
export const READ_SCOPES = ['user-read-currently-playing', 'user-read-recently-played', 'playlist-read-private']
const SCOPES = READ_SCOPES.join(' ')

// Redirect back to wherever the app is served from (works for both the
// 127.0.0.1 dev server and a deployed Pages URL).
function redirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

export interface SpotifyTrackResult {
  spotifyId: string
  title: string
  artist: string
  durationSec: number
  albumArtUrl?: string
  album?: string
  year?: string
}

interface StoredToken {
  accessToken: string
  refreshToken?: string
  scope?: string
  expiresAt: number
}

export function isSpotifyConfigured(): boolean {
  return !!CLIENT_ID
}

export function isSpotifyConnected(): boolean {
  return loadToken() !== null
}

// True only if the stored token was granted the given scopes (default: the read
// scopes the My Spotify page needs). A token from before scopes were requested
// returns false → the page prompts a one-time reconnect.
export function hasSpotifyScopes(required: string[] = READ_SCOPES): boolean {
  const tok = loadToken()
  if (!tok) return false
  const granted = (tok.scope ?? '').split(' ').filter(Boolean)
  return required.every((s) => granted.includes(s))
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

function saveToken(data: {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}): void {
  const existing = loadToken()
  const token: StoredToken = {
    accessToken: data.access_token,
    // Refresh responses don't always include a new refresh token / scope — keep the old.
    refreshToken: data.refresh_token ?? existing?.refreshToken,
    scope: data.scope ?? existing?.scope,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

export function spotifyLogout(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ---- PKCE helpers ----

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFrom(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

// Kick off the OAuth redirect. Full-page navigation; the app reloads on return.
export async function spotifyLogin(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set')
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFrom(verifier),
    scope: SCOPES,
  })
  window.location.href = `${AUTH_URL}?${params.toString()}`
}

// Handle the `?code=...` redirect on app load. Returns true if a token was
// obtained. Safe to call on every load — no-ops when there's no code.
export async function spotifyHandleRedirect(): Promise<boolean> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code || !CLIENT_ID) return false
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) return false

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  localStorage.removeItem(VERIFIER_KEY)
  // Clean the auth params out of the URL regardless of outcome.
  window.history.replaceState({}, '', redirectUri())
  if (!res.ok) return false
  saveToken(await res.json())
  return true
}

async function getAccessToken(): Promise<string | null> {
  const token = loadToken()
  if (!token) return null
  if (Date.now() < token.expiresAt - 30_000) return token.accessToken
  if (!token.refreshToken || !CLIENT_ID) return null

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    spotifyLogout()
    return null
  }
  saveToken(await res.json())
  return loadToken()?.accessToken ?? null
}

interface SpotifyApiTrack {
  id: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album: { name: string; release_date?: string; images: { url: string }[] }
}

export async function searchTracks(query: string): Promise<SpotifyTrackResult[]> {
  const q = query.trim()
  if (q === '') return []
  const token = await getAccessToken()
  if (!token) throw new Error('Not connected to Spotify')

  const params = new URLSearchParams({ q, type: 'track', limit: '10' })
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    spotifyLogout()
    throw new Error('Spotify session expired — reconnect')
  }
  if (!res.ok) {
    // Surface Spotify's actual error message (e.g. a 400 usually means a
    // malformed/expired bearer token — Spotify returns 400, not 401, for that).
    let detail = ''
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      if (body?.error?.message) detail = `: ${body.error.message}`
    } catch {
      /* no JSON body */
    }
    throw new Error(`Spotify search failed (${res.status})${detail}`)
  }

  const data = (await res.json()) as { tracks?: { items: SpotifyApiTrack[] } }
  return (data.tracks?.items ?? []).map(mapApiTrack)
}

// ---- Authed helpers + read endpoints (the My Spotify page) ----

function mapApiTrack(t: SpotifyApiTrack): SpotifyTrackResult {
  return {
    spotifyId: t.id,
    title: t.name,
    artist: (t.artists ?? []).map((a) => a.name).join(', '),
    durationSec: Math.round((t.duration_ms ?? 0) / 1000),
    albumArtUrl: t.album?.images?.at(-1)?.url ?? t.album?.images?.[0]?.url,
    album: t.album?.name,
    year: t.album?.release_date?.slice(0, 4),
  }
}

async function spotifyFetch(path: string): Promise<Response> {
  const token = await getAccessToken()
  if (!token) throw new Error('Not connected to Spotify')
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    spotifyLogout()
    throw new Error('Spotify session expired — reconnect')
  }
  return res
}

async function spotifyJson<T>(path: string): Promise<T> {
  const res = await spotifyFetch(path)
  if (!res.ok) {
    let detail = ''
    try {
      const b = (await res.json()) as { error?: { message?: string } }
      if (b?.error?.message) detail = `: ${b.error.message}`
    } catch {
      /* no body */
    }
    throw new Error(`Spotify request failed (${res.status})${detail}`)
  }
  return res.json() as Promise<T>
}

export interface SpotifyProfile {
  displayName: string
  avatarUrl?: string
}
export async function getMe(): Promise<SpotifyProfile> {
  const d = await spotifyJson<{ display_name?: string; images?: { url: string }[] }>('/me')
  return { displayName: d.display_name || 'You', avatarUrl: d.images?.[0]?.url }
}

export interface NowPlaying {
  track: SpotifyTrackResult
  isPlaying: boolean
  progressSec: number
}
export async function getCurrentlyPlaying(): Promise<NowPlaying | null> {
  const res = await spotifyFetch('/me/player/currently-playing')
  if (res.status === 204) return null // nothing playing
  if (!res.ok) throw new Error(`Spotify request failed (${res.status})`)
  const d = (await res.json()) as { is_playing?: boolean; progress_ms?: number; item?: SpotifyApiTrack | null }
  if (!d.item?.id) return null
  return {
    track: mapApiTrack(d.item),
    isPlaying: !!d.is_playing,
    progressSec: Math.round((d.progress_ms ?? 0) / 1000),
  }
}

export interface RecentlyPlayedItem {
  track: SpotifyTrackResult
  playedAt: string
}
export async function getRecentlyPlayed(limit = 20): Promise<RecentlyPlayedItem[]> {
  const d = await spotifyJson<{ items?: { track: SpotifyApiTrack; played_at: string }[] }>(
    `/me/player/recently-played?limit=${limit}`,
  )
  return (d.items ?? [])
    .filter((it) => it.track?.id)
    .map((it) => ({ track: mapApiTrack(it.track), playedAt: it.played_at }))
}

export interface SpotifyPlaylistSummary {
  id: string
  name: string
  imageUrl?: string
  trackCount: number
  owner: string
}
export async function getMyPlaylists(limit = 50): Promise<SpotifyPlaylistSummary[]> {
  const d = await spotifyJson<{
    items?: {
      id: string
      name: string
      images?: { url: string }[]
      tracks?: { total: number }
      owner?: { display_name?: string }
    }[]
  }>(`/me/playlists?limit=${limit}`)
  return (d.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.images?.[0]?.url,
    trackCount: p.tracks?.total ?? 0,
    owner: p.owner?.display_name ?? '',
  }))
}

export async function getPlaylistTracks(id: string): Promise<SpotifyTrackResult[]> {
  const out: SpotifyTrackResult[] = []
  for (let offset = 0; offset < 300; offset += 100) {
    const d = await spotifyJson<{ items?: { track: SpotifyApiTrack | null }[] }>(
      `/playlists/${id}/tracks?limit=100&offset=${offset}`,
    )
    const items = d.items ?? []
    for (const it of items) if (it.track?.id) out.push(mapApiTrack(it.track))
    if (items.length < 100) break
  }
  return out
}
