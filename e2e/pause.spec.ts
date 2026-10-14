import { expect, test } from './fixtures.ts';
import { advance, startMatch, state } from './helpers/game.ts';

test.describe('Pause, focus loss and resume @desktop', () => {
  test('Escape pauses: no time passes (simulated or real) until Resume', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    await advance(page, 1000);

    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Resume' })).toBeFocused();
    const paused = await state(page);
    expect(paused).toMatchObject({ paused: true, elapsedMs: 1000 });

    await advance(page, 2000);
    await page.waitForTimeout(2000);
    expect((await state(page)).elapsedMs).toBe(1000);
    await expect(page.getByRole('region', { name: 'Match status' })).toContainText('01:59');

    await dialog.getByRole('button', { name: 'Resume' }).click();
    await expect(dialog).toBeHidden();
    await advance(page, 1000);
    expect((await state(page)).elapsedMs).toBe(2000);
  });

  test('controls held before the pause do not carry over after resuming', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
    await advance(page, 300);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Resume' }).click();
    await advance(page, 1500);
    const after = await state(page);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('Space');

    expect(after.player.speed).toBe(0); // coasted to a stop, no more thrust
    expect(after.projectiles).toBe(0); // no new shots after resuming
  });

  test('hiding the tab pauses automatically; resuming needs an explicit action', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    await advance(page, 500);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('dialog', { name: 'Paused' })).toContainText('tab was hidden');
    await advance(page, 3000);
    expect((await state(page)).elapsedMs).toBe(500);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(page, 1000);
    expect((await state(page)).paused).toBe(true);
    await page.getByRole('button', { name: 'Resume' }).click();
    await advance(page, 1000);
    expect((await state(page)).elapsedMs).toBe(1500);
  });

  test('losing window focus pauses automatically', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    await advance(page, 500);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: 'Paused' })).toContainText('lost focus');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await advance(page, 2000);
    expect(await state(page)).toMatchObject({ paused: true, elapsedMs: 500 });
    await page.getByRole('button', { name: 'Resume' }).click();
    expect((await state(page)).paused).toBe(false);
  });
});
