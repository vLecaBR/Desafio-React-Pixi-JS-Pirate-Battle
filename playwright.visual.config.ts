import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

/**
 * Visual regression run (`npm run test:visual`). Baselines are generated and
 * compared inside the official Playwright Docker image (see README), so font
 * rendering and GPU differences between host systems do not cause false diffs.
 */
export default defineConfig({
  ...base,
  grep: /@visual/,
  projects: (base.projects ?? []).map((project) => ({ ...project, grepInvert: undefined })),
  reporter: [['html', { outputFolder: 'reports/playwright-visual', open: 'never' }], ['list']],
});
