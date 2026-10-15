import { expect, test } from './fixtures.ts';
import {
  advanceAndState,
  advanceTwice,
  defeatThenAdvance,
  finishByDefeat,
  setOptions,
  startMatch,
} from './helpers/game.ts';

test.describe('End of match and restart', () => {
  test('ends when time is up and freezes the simulation', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    await setOptions(page, 60, 3);
    await startMatch(page);
    await page.keyboard.down('KeyW');
    const [ended, later] = await advanceTwice(page, 61_000, 5000);
    await page.keyboard.up('KeyW');

    expect(ended).toMatchObject({ phase: 'ended', endReason: 'time_up', elapsedMs: 60_000 });
    expect(later).toEqual(ended);

    await expect(page.getByRole('heading', { name: 'Battle complete' })).toBeVisible();
    await expect(page.getByText('Points · 01:00 · Time up')).toBeVisible();
  });

  test('ends when the player is destroyed; nothing changes afterwards', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'low-health' });
    await startMatch(page);
    const [ended, later] = await defeatThenAdvance(page, 3000, 'Space');

    expect(ended).toMatchObject({ endReason: 'defeated', score: 0 });
    expect(ended.player.hp).toBe(0);
    expect(later).toEqual(ended);
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
  });

  test('Play again starts a clean match', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'low-health' });
    await startMatch(page);
    await finishByDefeat(page);
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();

    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForFunction(() => window.__PB__?.state()?.phase === 'running');
    const fresh = await advanceAndState(page, 0);
    expect(fresh).toMatchObject({ elapsedMs: 0, score: 0, spawnsSoFar: 0, projectiles: 0 });
    expect(fresh.remainingMs).toBe(120_000);
    expect(fresh.player.hp).toBe(20); // the preset's starting health
    expect(fresh.enemies).toHaveLength(1);
    await expect(page.locator('canvas')).toHaveCount(1);
  });
});
