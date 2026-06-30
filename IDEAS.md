# DJ Secretary — Backlog

Captured 2026-06-23. None of these are built yet — parking them here so we can pick up easily.

## Next up (immediate)

- **Deploy to GitHub Pages** so it's a usable hosted website. Involves:
  - Create a GitHub repo and push.
  - Set Vite `base` to the repo path (e.g. `/dj-secretary/`) — or a custom domain.
  - Deploy via GitHub Actions (or a `gh-pages` branch).
  - Add the live URL (e.g. `https://<user>.github.io/dj-secretary/`) as a **second redirect URI**
    in the Spotify dashboard so Connect Spotify works in production.
  - Reminder: Spotify dev-mode allowlist (≤25 users, added under Settings → User Management)
    still applies in production until "extended quota mode" is approved.

## Shipped (2026-06-23)

- ✅ **Genre filter** — Genres browse group in the sidebar, above Tags; click to filter the library.
- ✅ **Multi-select bulk edit in playlists/sets** — row checkboxes + a bulk bar (add tag to selected,
  remove from collection, select all/clear). Available in the normal view; a list under an active
  tag-filter stays read-only.
- ✅ **Searchable multi-select add-tracks picker** — "+ Add tracks" opens a searchable modal with
  checkboxes and "Add N tracks", replacing the one-at-a-time dropdown.

## Feature ideas (later)

1. **"My Spotify" section (read-only, separate DB)** — a dedicated tab showing your Spotify
   *recently played* and *your playlists*, purely as a quick-import source into the library.
   Keep the two databases separate — this is browse/import, NOT sync. (Technical note: this needs
   added OAuth scopes — `user-read-recently-played` and `playlist-read-private` — so the PKCE
   login would re-prompt for consent. Today we request no scopes.)
2. **Inline editing in the track list** — double-click a cell (BPM, key, energy, …) to edit in
   place, iTunes-style, instead of only through the side inspector.
