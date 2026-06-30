import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// `base` is the GitHub Pages project subpath in production (https://<user>.github.io/dj-secretary/),
// and '/' in dev so the local server + Spotify 127.0.0.1 redirect keep working.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/dj-secretary/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DJ Secretary',
        short_name: 'DJ Secretary',
        description: 'A graph-based note-taking app for DJs.',
        theme_color: '#0b0b0d',
        background_color: '#0b0b0d',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  // Listen on all interfaces so both localhost and 127.0.0.1 reach the dev server
  // (Spotify PKCE requires the 127.0.0.1 redirect).
  server: { host: true, port: 5173 },
}))
