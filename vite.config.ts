import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /<repo>/; BASE_PATH overrides it for other hosts.
const base = process.env.BASE_PATH ?? '/geofrance/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'GeoFrance',
        short_name: 'GeoFrance',
        description: 'Track the French communes, departments and regions you have visited.',
        lang: 'en',
        theme_color: '#08519c',
        background_color: '#f4f1ea',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Geography files are cached the first time they are used, so the app works offline afterwards.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}data/`),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'geo-data', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 }, // MapLibre alone is about 1 MB
  test: { include: ['tests/**/*.test.ts'] },
})
