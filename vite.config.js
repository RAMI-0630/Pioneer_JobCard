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
        // Precache all built app-shell assets so they're available offline immediately
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Navigate fallback ensures the SPA shell is served for all routes offline
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
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
        ],
      },
    }),
  ],
})
