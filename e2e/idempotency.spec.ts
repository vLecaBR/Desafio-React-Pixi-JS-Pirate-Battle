import { expect, NETWORK_LOG, test } from './fixtures.ts';
import {
  countRecords,
  dbStats,
  finishByDefeat,
  lastMatchId,
  setScenario,
  startMatch,
} from './helpers/game.ts';

test.describe('Idempotency and stale responses @desktop', () => {
  test('a timeout after the server saved the match recovers without a duplicate', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'low-health', scenario: 'post-timeout-after-commit' });
    const before = await dbStats(page);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/matches')) {
        posts.push(request.headers()['idempotency-key'] ?? '');
      }
    });

    await startMatch(page);
    await finishByDefeat(page);
    await expect(page.getByText("Saving to the Captain's Log")).toBeVisible();
    // First attempt times out (4 s) although committed; the retry gets the existing record.
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible({ timeout: 20_000 });

    const matchId = await lastMatchId(page);
    expect(await countRecords(page, matchId)).toBe(1);
    expect((await dbStats(page)).records).toBe(before.records + 1);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(posts)).toEqual(new Set([matchId]));
  });

  test('repeated Retry clicks send a single request', async ({ page, gotoApp, consoleGuard }) => {
    consoleGuard.allow(NETWORK_LOG);
    await gotoApp({ preset: 'low-health', scenario: 'outage-on-finish' });
    await startMatch(page);
    await finishByDefeat(page);
    const retry = page.getByRole('button', { name: 'Retry now' });
    await expect(retry).toBeVisible({ timeout: 15_000 });

    await setScenario(page, 'success');
    let posts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/matches')) posts++;
    });
    // Three clicks in the same task, before React can re-render the button away.
    await retry.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
    expect(posts).toBe(1);
    expect(await countRecords(page, await lastMatchId(page))).toBe(1);
  });

  test('out-of-order responses never overwrite the latest selection', async ({ page, gotoApp }) => {
    await gotoApp({ scenario: 'out-of-order' });
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.locator('.log-table tbody tr').first()).toBeVisible({ timeout: 8000 });

    // Two quick changes: the first request is slow, the second fast.
    await page.getByLabel('Battle length').selectOption('60');
    await page.getByLabel('Spawn interval').selectOption('2');
    await page.waitForTimeout(2500); // let every pending response arrive

    const expected = await page.evaluate(async () => {
      const response = await fetch(
        '/api/ranking?sessionTimeSec=60&spawnIntervalSec=2&page=1&pageSize=5',
      );
      const body = (await response.json()) as { items: { playerName: string }[] };
      return body.items.map((item) => item.playerName);
    });
    await expect(page.getByText('60 second battles · 2 second spawn interval')).toBeVisible();
    const shown = await page
      .locator('.log-table tbody tr .log-table__captain')
      .evaluateAll((cells) => cells.map((cell) => cell.textContent.replace('You', '').trim()));
    expect(shown).toEqual(expected);
  });
});
