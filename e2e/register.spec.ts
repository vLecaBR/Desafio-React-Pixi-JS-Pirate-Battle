import { expect, NETWORK_LOG, test } from './fixtures.ts';
import {
  countRecords,
  finishByDefeat,
  lastMatchId,
  setOptions,
  setScenario,
  startMatch,
} from './helpers/game.ts';

test.describe('Match registration', () => {
  test('a finished match is registered once and shows up in both tabs', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'low-health' });
    // A configuration without fixtures, so the new record is easy to find.
    await setOptions(page, 70, 3);
    await startMatch(page);
    await finishByDefeat(page);
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
    const matchId = await lastMatchId(page);
    expect(await countRecords(page, matchId)).toBe(1);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByText('70 second battles · 3 second spawn interval')).toBeVisible();
    const rankingRow = page.locator('.log-table tbody tr');
    await expect(rankingRow).toHaveCount(1);
    await expect(rankingRow.first()).toContainText('You');
    await expect(rankingRow.first()).toHaveClass(/is-highlighted/);

    await page.getByRole('tab', { name: 'Match history' }).click();
    const historyRow = page.locator('.log-table tbody tr');
    await expect(historyRow).toHaveCount(1);
    await expect(historyRow.first()).toContainText('Defeated');
    await expect(historyRow.first()).toHaveClass(/is-highlighted/);
  });

  test('an outage at the end keeps the match pending across a refresh until Retry succeeds', async ({
    page,
    gotoApp,
    consoleGuard,
  }) => {
    consoleGuard.allow(NETWORK_LOG);
    await gotoApp({ preset: 'low-health', scenario: 'outage-on-finish' });
    await startMatch(page);
    await finishByDefeat(page);
    await expect(page.getByText(/Not saved yet: The server is unavailable/)).toBeVisible({
      timeout: 15_000,
    });
    const matchId = await lastMatchId(page);
    expect(await countRecords(page, matchId)).toBe(0);

    // The player can keep playing while the registration is pending.
    await expect(page.getByRole('button', { name: 'Play again' })).toBeEnabled();

    await page.reload();
    await expect(page.getByText('1 battle is waiting to be saved.')).toBeVisible();
    await page.getByRole('button', { name: 'View result' }).click();
    await expect(page.getByText(/Not saved yet/)).toBeVisible({ timeout: 15_000 });

    await setScenario(page, 'success');
    await page.getByRole('button', { name: 'Retry now' }).click();
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
    expect(await countRecords(page, matchId)).toBe(1);

    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByText(/waiting to be saved/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Match history' }).click();
    await expect(page.locator('.log-table tbody tr')).toHaveCount(1);
  });
});
