import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon-180x180.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'shortcut-income-96x96.png',
        'shortcut-expense-96x96.png',
      ],
      manifest: {
        name: 'Nubung Yuk',
        short_name: 'Nubung Yuk',
        description: 'Aplikasi pencatat tabungan dan buku utang pribadi offline-first tanpa akun.',
        theme_color: '#0d9488',
        background_color: '#090d16',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
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
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Catat Masuk',
            short_name: 'Masuk',
            description: 'Catat saldo masuk ke tabungan',
            url: '/tabungan?action=income',
            icons: [{ src: '/shortcut-income-96x96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Catat Keluar',
            short_name: 'Keluar',
            description: 'Catat saldo keluar dari tabungan',
            url: '/tabungan?action=expense',
            icons: [{ src: '/shortcut-expense-96x96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Tambah Utang',
            short_name: 'Utang',
            description: 'Catat catatan utang baru',
            url: '/utang?action=create',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'documents-cache',
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'worker',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
  },
});
