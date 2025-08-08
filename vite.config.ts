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
          manifest: {
              name: 'Trip Helper',
              short_name: 'Trip Helper',
              description: 'A web app to help you plan your trip',
              theme_color: '#ffffff',
              background_color: '#ffffff',
              icons: [
                  {
                      src: '/favicon.ico',
                      sizes: 'any',
                      type: 'image/ico',
                  },
                  {
                      src: '/android-chrome-192x192.png',
                      sizes: '192x192',
                      type: 'image/png',
                  },
                  {
                      src: '/android-chrome-512x512.png',
                      sizes: '512x512',
                      type: 'image/png',
                  },
              ],
          },
      }),
  ],
    resolve: {
      alias: {
          '@': resolve(__dirname,'./src'),
      },
    }
})
