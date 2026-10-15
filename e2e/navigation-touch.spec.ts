import type { CDPSession, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { advance, dbStats, startMatch, state } from './helpers/game.ts';

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Real multi-touch through the DevTools protocol (several fingers held at once). */
async function touch(
  session: CDPSession,
  type: 'touchStart' | 'touchEnd',
  points: { x: number; y: number }[],
) {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : points.map((p, id) => ({ ...p, id })),
  });
}

async function pressAndHold(page: Page, buttons: Locator[], ms: number) {
  const session = await page.context().newCDPSession(page);
  const points = await Promise.all(buttons.map(center));
  await touch(session, 'touchStart', points);
  await advance(page, ms);
  await touch(session, 'touchEnd', []);
  await session.detach();
}

test.describe('Abandoning and navigating', () => {
  test('leaving a match records nothing', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    const before = await dbStats(page);
    await startMatch(page);
    await advance(page, 3000);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();

    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await dbStats(page)).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem('pb.lastResult.v1'))).toBeNull();
    const pending = await page.evaluate(() => localStorage.getItem('pb.pending.v1') ?? '[]');
    expect(JSON.parse(pending)).toEqual([]);
    await expect(page.getByText(/Last battle/)).toHaveCount(0);
  });

  test('reloading during a match abandons it', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    const before = await dbStats(page);
    await startMatch(page);
    await advance(page, 2000);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await dbStats(page)).toEqual(before);
  });

  test('repeated navigation between screens leaks nothing and logs no errors', async ({
    page,
    gotoApp,
  }) => {
    // Five full match loads: allow more than the default budget on slow CI runners.
    test.setTimeout(240_000);
    await gotoApp({ preset: 'sandbox' });
    for (let i = 0; i < 5; i++) {
      await startMatch(page);
      await expect(page.locator('canvas')).toHaveCount(1);
      await advance(page, 500);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Main menu' }).click();
      await expect(page.locator('canvas')).toHaveCount(0);
      await page.getByRole('button', { name: 'Options' }).click();
      await page.getByRole('button', { name: 'Main menu' }).click();
      await page.getByRole('button', { name: 'Ranking' }).click();
      await expect(page.getByRole('heading', { name: "Captain's Log" })).toBeVisible();
      await page.getByRole('button', { name: 'Main menu' }).click();
    }
    expect(await page.evaluate(() => window.__PB__?.state() ?? null)).toBeNull();
  });
});

test.describe('Touch controls @mobile', () => {
  test('holding several touch buttons sails, turns and fires at the same time', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    const start = await startMatch(page);
    const controls = page.getByLabel('Touch controls');
    await expect(controls).toBeVisible();

    await pressAndHold(
      page,
      [
        controls.getByRole('button', { name: 'Sail forward' }),
        controls.getByRole('button', { name: 'Turn right' }),
        controls.getByRole('button', { name: 'Fire front cannon' }),
      ],
      600,
    );
    const after = await state(page);
    expect(
      Math.hypot(after.player.x - start.player.x, after.player.y - start.player.y),
    ).toBeGreaterThan(20);
    expect(after.player.heading).toBeGreaterThan(start.player.heading + 1);
    expect(after.projectiles).toBeGreaterThan(0);

    // Released: no more turning or firing.
    const heading = after.player.heading;
    await advance(page, 1500);
    const later = await state(page);
    expect(later.player.heading).toBeCloseTo(heading, 5);
    expect(later.projectiles).toBe(0);
  });

  test('a single tap fires one broadside', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    await pressAndHold(page, [page.getByRole('button', { name: 'Fire left broadside' })], 50);
    expect((await state(page)).projectiles).toBe(3);
  });

  test('portrait shows a rotate prompt and pauses; landscape needs Resume', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);
    const landscape = page.viewportSize() ?? { width: 863, height: 412 };

    await page.setViewportSize({ width: landscape.height, height: landscape.width });
    await expect(page.getByText('Rotate your device to landscape')).toBeVisible();
    expect((await state(page)).paused).toBe(true);

    await page.setViewportSize(landscape);
    await expect(page.getByText('Rotate your device to landscape')).toBeHidden();
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toContainText('portrait');
    await dialog.getByRole('button', { name: 'Resume' }).tap();
    expect((await state(page)).paused).toBe(false);
  });
});
