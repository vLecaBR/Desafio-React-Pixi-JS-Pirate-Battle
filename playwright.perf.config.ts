import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Profiling runs (`npm run perf`), separate from the regular E2E suite.
 *
 * - Production build served by `vite preview`, `?perf=1` (real clock).
 * - Reference environment: headless Chromium with hardware GPU (ANGLE/D3D11 on
 *   Windows) via the flags below. Set `PERF_SOFTWARE_GL=1` to measure the default
 *   CPU-only renderer (SwiftShader) instead, as a lower bound.
 * - One worker, so nothing competes for CPU/GPU during measurements.
 */
const gpuArgs = process.env['PERF_SOFTWARE_GL']
  ? []
  : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization'];

export default defineConfig({
  testDir: './e2e/perf',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 8 * 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-perf',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        launchOptions: { args: gpuArgs },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
