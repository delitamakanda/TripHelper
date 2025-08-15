import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
      tailwindcss(),
      VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
          devOptions: {
              enabled: true
          },
          manifest: {
              name: 'Trip Helper',
              short_name: 'Trip Helper',
              description: 'A web app to help you plan your trip',
              theme_color: '#ffffff',
              background_color: '#ffffff',
              icons: [
                  {
                      src: '/pwa-192x192.png',
                      sizes: '192x192',
                      type: 'image/png',
                  },
                  {
                      src: '/pwa-512x512.png',
                      sizes: '512x512',
                      type: 'image/png',
                  },
                  {
                      src: '/pwa-maskable-192x192.png',
                      sizes: '192x192',
                      type: 'image/png',
                      purpose: "maskable",
                  },
                  {
                      src: '/pwa-maskable-512x512.png',
                      sizes: '512x512',
                      type: 'image/png',
                      purpose: "maskable",
                  }
              ],
              scope: "/",
              start_url: "/",
              display: "standalone",
              orientation: "portrait"
          },
          workbox: {
              runtimeCaching: [
                  {
                      urlPattern: /^https:\/\/api\.fastforex\.io\/.*/i,
                      handler: 'NetworkFirst',
                      options: {
                          cacheName: 'api-cache',
                          expiration: {
                              maxEntries: 10,
                              maxAgeSeconds: 60 * 60 * 24
                          },
                      },
                  }
              ]
          }
      }),
  ],
    resolve: {
      alias: {
          '@': resolve(__dirname,'./src'),
      },
    }
})
