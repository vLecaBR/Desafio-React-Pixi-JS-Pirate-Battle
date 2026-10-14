import { test as base, expect, type Page } from '@playwright/test';
import type { PresetId } from '../src/game/config/presets.ts';
import type { ScenarioId } from '../src/mocks/scenarios.ts';

export interface AppOptions {
  readonly scenario?: ScenarioId;
  readonly seed?: number;
  readonly preset?: PresetId;
  readonly params?: Readonly<Record<string, string>>;
}

interface ConsoleGuard {
  /** Allows console errors matching the pattern (e.g. network logs in failure scenarios). */
  allow(pattern: RegExp): void;
}

/** Browser network log line for mocked error responses (not an application error). */
export const NETWORK_LOG = /Failed to load resource/;

/**
 * Shared fixtures:
 * - `gotoApp` opens the app in test mode (`?e2e=1`) with a fixed seed, an optional
 *   network scenario and an optional gameplay preset, and waits for the mocked API.
 *   Every test runs in a fresh browser context (empty storage, new service worker),
 *   so tests never share state.
 * - `consoleGuard` (automatic) fails the test on any unexpected console error or
 *   uncaught page error.
 */
export const test = base.extend<{
  gotoApp: (options?: AppOptions) => Promise<void>;
  consoleGuard: ConsoleGuard;
}>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: RegExp[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`);
      });
      await use({
        allow: (pattern) => {
          allowed.push(pattern);
        },
      });
      const unexpected = errors.filter((text) => !allowed.some((pattern) => pattern.test(text)));
      expect(unexpected, 'unexpected console errors').toEqual([]);
    },
    { auto: true },
  ],

  gotoApp: async ({ page }, use) => {
    await use(async (options = {}) => {
      const params = new URLSearchParams({
        e2e: '1',
        seed: String(options.seed ?? 1),
        scenario: options.scenario ?? 'success',
        ...(options.preset ? { preset: options.preset } : {}),
        ...options.params,
      });
      await page.goto(`/?${params.toString()}`);
      await waitForApp(page);
    });
  },
});

/** Waits until the menu is interactive and the mocked API is running. */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__PB_LAB__ !== undefined);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}

export { expect };
