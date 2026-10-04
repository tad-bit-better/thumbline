import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/engine',
  test: {
    name: '@thumbline/engine',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: true,
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/index.ts', 'src/types.ts'],
      reporter: ['text-summary', 'html'],
      // PLAN.md M1: ≥ 90% coverage.
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
}));
