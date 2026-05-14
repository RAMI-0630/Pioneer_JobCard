import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifest: false, // manifest is provided via public/manifest.webmanifest
      workbox: {
        // Cache app-shell assets with CacheFirst
        runtimeCaching: [
          {
            // Supabase GET requests — NetworkFirst with 3-second timeout
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') &&
              request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pwa-supabase-api',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // App-shell assets: HTML, JS, CSS, fonts, images — CacheFirst
            urlPattern: ({ request }) =>
              request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'font' ||
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'pwa-app-shell',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Supabase POST/PATCH/DELETE must NOT be cached — pass through only
        // (Workbox only caches GET by default; non-GET requests are never cached
        //  unless explicitly configured, so no extra config needed here)
      },
    }),
  ],
})
