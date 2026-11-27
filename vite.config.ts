import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_COLOR = '#b91c1c';

// GitHub Pages serves the app from https://<user>.github.io/hanzi-srs/
export default defineConfig({
  base: '/hanzi-srs/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Hanzi SRS',
        short_name: 'Hanzi SRS',
        description: 'Learn Mandarin hanzi and pinyin with spaced repetition and stroke practice.',
        lang: 'en',
        theme_color: THEME_COLOR,
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        // start_url and scope default to Vite's `base` (/hanzi-srs/).
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell precache. Dictionary shards and stroke data will be runtime-cached later (M3/M5).
        // csv: import templates must download offline too.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,csv}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Coverage gate applies to the core layers (SPEC §9: domain and db >= 80%) and importers (untrusted input).
      include: ['src/domain/**/*.ts', 'src/db/**/*.ts', 'src/importers/**/*.ts'],
      exclude: ['**/*.test.ts', '**/test-utils/**'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
