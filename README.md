# DJ Secretary

A graph-augmented note-taking app for DJs. It feels like a music library — add
tracks, tag them, make playlists — except what it stores is your **notes about**
tracks, not the audio. On top of the usual linear views it adds a **transition
graph**: directed, labeled edges saying "this track mixes well into that one,
here, like this."

"Performing" is just navigating: find the track you're playing, look at its
branches (what mixes out of / into it), and click through.

It is **not** a DJ engine — no audio playback, no live sync, not a Rekordbox
replacement. Just structured notes with a graph view.

## Stack

- Vite + React + TypeScript + Tailwind CSS (dark)
- Dexie / IndexedDB — local-first, fully offline, no login for your data
- Zustand — UI state
- React Flow (`@xyflow/react`) — the transition graph
- Spotify Web API (PKCE, optional) — auto-fills title / artist / duration / art

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # type-check + production build
```

Your data lives in the browser. Use **Export / Import** (top bar) to back it up
as JSON or move it between devices.

## Spotify (optional)

Adding a track works fully by hand. To enable the "Connect Spotify" search that
auto-fills metadata, copy `.env.example` to `.env`, create a free app at
<https://developer.spotify.com/dashboard>, register the redirect URIs listed in
that file, and paste in your Client ID.

Heads-up: Spotify removed BPM / musical key / energy from its API for new apps,
so those stay as manual fields.

## Data model

- **Track** — title, artist, duration, BPM, key, genre, energy, tags, notes
- **Annotation** — a time-anchored note on a track (cue in/out, motif, EQ, filter, custom)
- **Edge** — a directed transition between two tracks (exit/entry cue, technique, rating)
- **Playlist** — an ordered list of tracks

Edges carry enough (cue points, technique, rating) that an auto set-generator
could be added later without a migration.
