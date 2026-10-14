import { expect, NETWORK_LOG, test } from './fixtures.ts';
import { setScenario } from './helpers/game.ts';

test.describe("Captain's Log queries", () => {
  test('ranking: loading state, rows, pagination and configuration filter', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ scenario: 'slow' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('120 second battles · 3 second spawn interval')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Loading ranking' })).toBeAttached();

    const rows = page.locator('.log-table tbody tr');
    await expect(rows).toHaveCount(5, { timeout: 8000 });
    await expect(rows.first()).toContainText('01');
    await expect(page.getByText('Page 1 of 6', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Page 2 of 6', { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(rows.first()).toContainText('06');

    await page.getByLabel('Battle length').selectOption('60');
    await page.getByLabel('Spawn interval').selectOption('2');
    await expect(page.getByText('60 second battles · 2 second spawn interval')).toBeVisible();
    await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible({ timeout: 8000 });
  });

  test('tabs switch with the keyboard and history paginates @desktop', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ scenario: 'many-pages' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    await page.getByRole('tab', { name: 'Ranking' }).focus();
    await page.keyboard.press('ArrowRight');
    const history = page.getByRole('tab', { name: 'Match history' });
    await expect(history).toBeFocused();
    await expect(history).toHaveAttribute('aria-selected', 'true');

    await expect(page.locator('.log-table tbody tr')).toHaveCount(5);
    await expect(page.getByText(/^Page 1 of [3-9]$/)).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText(/^Page 2 of [3-9]$/)).toBeVisible();
  });

  test('empty lists show their empty state in both tabs @desktop', async ({ page, gotoApp }) => {
    await gotoApp({ scenario: 'empty' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByText('No battles recorded yet')).toBeVisible();
    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('No battles recorded yet')).toBeVisible();
    await expect(page.getByText('Your completed battles will appear here.')).toBeVisible();
  });

  test('ranking failure shows an error with Retry; the other tab still works @desktop', async ({
    page,
    gotoApp,
    consoleGuard,
  }) => {
    consoleGuard.allow(NETWORK_LOG);
    await gotoApp({ scenario: 'ranking-fails' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Ranking could not be loaded', { timeout: 15_000 });
    await expect(alert).toContainText('unavailable');

    await page.getByRole('tab', { name: 'Match history' }).click();
    await expect(page.getByText('No battles recorded yet')).toBeVisible();

    await page.getByRole('tab', { name: 'Ranking' }).click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await setScenario(page, 'success');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.log-table tbody tr')).toHaveCount(5);
  });

  test('history failure shows an error with Retry @desktop', async ({
    page,
    gotoApp,
    consoleGuard,
  }) => {
    consoleGuard.allow(NETWORK_LOG);
    await gotoApp({ scenario: 'history-fails' });
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(page.getByRole('alert')).toContainText('Match history could not be loaded', {
      timeout: 15_000,
    });
    await setScenario(page, 'success');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('No battles recorded yet')).toBeVisible();
  });

  test('timeouts and HTTP errors are reported, not crashing @desktop', async ({
    page,
    gotoApp,
    consoleGuard,
  }) => {
    consoleGuard.allow(NETWORK_LOG);
    await gotoApp({ scenario: 'http-4xx' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    // 4xx is not retried: the error shows immediately.
    await expect(page.getByRole('alert')).toContainText('rejected (400)');
  });
});
