import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { advance, finishByDefeat, startMatch } from './helpers/game.ts';

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

test.describe('Visual regression @visual', () => {
  test('main menu', async ({ page, gotoApp }) => {
    await gotoApp();
    await settle(page);
    await expect(page).toHaveScreenshot('menu.png', { fullPage: true });
  });

  test('arena in a stable state', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox', seed: 7 });
    await startMatch(page);
    // Wait for the start hint to disappear, then render a deterministic frame.
    await expect(page.locator('.match-hint')).toHaveCount(0, { timeout: 10_000 });
    await advance(page, 0);
    await settle(page);
    await expect(page).toHaveScreenshot('arena.png');
  });

  test('result screen', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'low-health', seed: 7 });
    await startMatch(page);
    await finishByDefeat(page);
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot('result.png');
  });
});
