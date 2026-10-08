import { defineConfig, devices } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

/**
 * Performance budget (README: Known limitations and roadmap): the production
 * build, served by `next start` on its own port so a dev server can keep 3000.
 * Build first: `pnpm nx build @thumbline/web`.
 */
const PORT = 3100;

export default defineConfig({
  testDir: './perf',
  outputDir: './test-output/perf',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `pnpm --dir apps/web exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    cwd: workspaceRoot,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
