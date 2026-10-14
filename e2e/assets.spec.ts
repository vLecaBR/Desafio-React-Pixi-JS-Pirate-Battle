import { expect, NETWORK_LOG, test } from './fixtures.ts';

// Requests served through a service worker bypass context.route(), so the MSW
// worker is blocked here (the game itself does not need the mocked API).
test.use({ serviceWorkers: 'block' });

test.describe('Asset loading @desktop', () => {
  test('shows progress, reports a failure accessibly and retries', async ({
    page,
    context,
    consoleGuard,
  }) => {
    consoleGuard.allow(NETWORK_LOG);
    // Without the worker, background sync hits the static server (404) — expected here.
    await page.goto('/?e2e=1&seed=1&preset=sandbox');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

    await context.route('**/assets/tilesheet/**', (route) => route.abort());
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Loading failed' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('could not be loaded');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused();
    expect(await page.evaluate(() => window.__PB__?.state() ?? null)).toBeNull();

    // Recover, slowing one file down so the progress bar is observable.
    await context.unroute('**/assets/tilesheet/**');
    await context.route('**/assets/tilesheet/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Try again' }).click();
    const progress = page.getByRole('progressbar');
    await expect(progress).toBeVisible();
    await expect(page.getByText(/Loading assets: \d+%/)).toBeVisible();

    await page.waitForFunction(() => window.__PB__?.state()?.phase === 'running');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Match status' })).toBeVisible();
  });
});
