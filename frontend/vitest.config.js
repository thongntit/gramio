import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'test/learning-api.test.js',
      'test/learning-store.test.js',
      'test/analytics.test.js',
      'test/*.test.jsx',
    ],
    setupFiles: ['./test/setup.js'],
    restoreMocks: true,
    clearMocks: true,
  },
});
