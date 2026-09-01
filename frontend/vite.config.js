import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo-mark.svg'],
      devOptions: { enabled: true, type: 'module' }, // service worker active in `npm run dev` too, for quick testing
      manifest: {
        name: 'FarmTrack',
        short_name: 'FarmTrack',
        description: 'Offline-first livestock and farm management',
        theme_color: '#4A5D3A',
        background_color: '#EDE7D8',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + assets cached so the app opens with zero connectivity.
        // Data itself lives in IndexedDB (see src/db.js), not the cache.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  server: { port: 5173 },
});
