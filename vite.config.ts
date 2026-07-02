import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Build-Zeitstempel, in den Einstellungen sichtbar – hilft, einen veralteten
    // PWA-Cache zu erkennen.
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    ),
  },
  build: {
    rollupOptions: {
      input: {
        // Haupt-App (Würfelspiel) + eigenständiges Invest-Cockpit unter /cockpit
        main: 'index.html',
        cockpit: 'cockpit.html',
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Das Cockpit und die API laufen außerhalb der Spiel-PWA – der
        // Service-Worker darf Navigationen dorthin nicht auf index.html umbiegen.
        navigateFallbackDenylist: [/^\/cockpit/, /^\/api\//],
      },
      manifest: {
        name: '10.000 – Die Clique',
        short_name: '10.000',
        description: 'Intelligenter Begleit-Rechner für das Würfelspiel Zehntausend.',
        theme_color: '#0a0e16',
        background_color: '#060910',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'de',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
