import { expect, test } from './fixtures.ts';
import { advance, setOptions, startMatch, state } from './helpers/game.ts';

test.describe('Options', () => {
  test('navigates, validates and saves, and persists after a reload', async ({ page, gotoApp }) => {
    await gotoApp();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('heading', { name: 'Options' })).toBeFocused();

    const session = page.getByRole('spinbutton', { name: 'Game session time' });
    const spawn = page.getByRole('spinbutton', { name: 'Enemy spawn time' });
    const save = page.getByRole('button', { name: 'Save' });
    await expect(session).toHaveValue('120');
    await expect(spawn).toHaveValue('3');
    await expect(save).toBeDisabled();

    for (const [value, message] of [
      ['59', /between 60 and 180/],
      ['181', /between 60 and 180/],
      ['95', /steps of 10/],
    ] as const) {
      await session.fill(value);
      await expect(session).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toHaveText(message);
      await expect(save).toBeDisabled();
    }
    await session.fill('90');
    await expect(session).toHaveAttribute('aria-invalid', 'false');

    for (const value of ['0', '10.5', '-1']) {
      await spawn.fill(value);
      await expect(page.getByRole('alert')).toHaveText(/between 1 and 10/);
      await expect(save).toBeDisabled();
    }
    await spawn.fill('4.5');
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.getByRole('button', { name: 'Increase game session time' }).click();
    await expect(session).toHaveValue('100');
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Options saved.' })).toBeVisible();
    await expect(save).toBeDisabled();

    await page.reload();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(session).toHaveValue('100');
    await expect(spawn).toHaveValue('4.5');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });

  test('corrupted stored options fall back to the defaults', async ({ page, gotoApp }) => {
    await gotoApp();
    await page.evaluate(() => {
      localStorage.setItem('pb.options.v1', '{"sessionTimeSec":"lots"}');
    });
    await page.reload();
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Game session time' })).toHaveValue('120');
    await expect(page.getByRole('spinbutton', { name: 'Enemy spawn time' })).toHaveValue('3');
  });

  test('a match uses a snapshot: changes during the match apply to the next one @desktop', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await setOptions(page, 90, 3);
    expect((await startMatch(page)).remainingMs).toBe(90_000);

    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await dialog.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByText('Changes apply to the next battle')).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Game session time' }).fill('60');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();

    await advance(page, 1000);
    expect((await state(page)).remainingMs).toBe(89_000);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();
    expect((await startMatch(page)).remainingMs).toBe(60_000);
  });
});
