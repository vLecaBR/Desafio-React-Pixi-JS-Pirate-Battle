import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);
const PORT = 4173;

/**
 * End-to-end tests run against the production build (`vite preview`), with the
 * MSW mocks active, in Chromium desktop and Chromium mobile (Pixel 7, landscape).
 *
 * Tags: `@desktop` / `@mobile` restrict a test to one project; `@visual` tests
 * (screenshot baselines) run only through `playwright.visual.config.ts`, inside
 * the official Playwright Docker image, so baselines never depend on the host OS.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // WebGL runs on the CPU in headless Chromium: keep parallelism modest.
  workers: CI ? 2 : 3,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  reporter: [['html', { outputFolder: 'reports/playwright-html', open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      grepInvert: /@mobile|@visual/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7 landscape'] },
      grepInvert: /@desktop|@visual/,
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
