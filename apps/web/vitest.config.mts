import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  plugins: [react()],
  resolve: {
    alias: {
      '@': join(import.meta.dirname, './src'),
      // jsdom can't run the dotLottie WASM renderer (and tests mustn't fetch it).
      '@lottiefiles/dotlottie-react': join(import.meta.dirname, './specs/stubs/dotlottie-react.tsx'),
    },
  },
  test: {
    name: '@thumbline/web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./specs/setup.ts'],
    include: [
      '{src,app,pages,specs}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
