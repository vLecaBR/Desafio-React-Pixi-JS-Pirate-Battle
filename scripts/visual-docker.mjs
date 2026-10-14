#!/usr/bin/env node
/**
 * Runs the visual regression tests inside the official Playwright Docker image, so
 * screenshot baselines are identical on every host (Windows, macOS, Linux, CI).
 *
 * Usage: npm run test:visual:docker              (compare against baselines)
 *        npm run test:visual:docker:update       (regenerate baselines)
 *
 * The image tag must match the installed @playwright/test version.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(
  readFileSync(path.join(root, 'node_modules/@playwright/test/package.json'), 'utf8'),
);
const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const extra = process.argv.slice(2).join(' ');

// node_modules is kept in a container volume so Linux binaries never touch the host.
const command = [
  'npm ci --no-audit --no-fund',
  `npx playwright test -c playwright.visual.config.ts ${extra}`.trim(),
].join(' && ');

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-e',
    'CI=1',
    '-v',
    `${root}:/work`,
    '-v',
    'pirate-battle-node-modules:/work/node_modules',
    '-w',
    '/work',
    image,
    'sh',
    '-c',
    command,
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
