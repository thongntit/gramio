import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'assets/icons/favicon-32.png',
        'assets/icons/icon-120.png',
        'assets/icons/icon-152.png',
        'assets/icons/icon-180.png',
        'assets/icons/icon-192.png',
        'assets/icons/icon-512.png',
        'assets/icons/icon-1024.png',
        'assets/icons/icon-maskable-512.png',
      ],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Gramio',
        short_name: 'Gramio',
        description: 'Practice English grammar and vocabulary.',
        theme_color: '#f6f7f8',
        background_color: '#f6f7f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/assets/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/assets/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/assets/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
