import { expect, test } from './fixtures.ts';
import { finishByDefeat, startMatch } from './helpers/game.ts';

test.describe('Result screen', () => {
  test('shows score, time, reason and registration status, and survives a refresh', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'low-health' });
    await startMatch(page);
    const { elapsedMs } = await finishByDefeat(page);
    const seconds = Math.floor(elapsedMs / 1000);
    const clock = `00:${String(seconds).padStart(2, '0')}`;

    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeFocused();
    await expect(page.locator('.result__score')).toHaveText('0');
    await expect(page.getByText(`Points · ${clock} · Defeated`)).toBeVisible();
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play again' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Main menu' })).toBeEnabled();

    await page.reload();
    await expect(page.getByText(`Last battle: 0 points · ${clock} · Defeated`)).toBeVisible();
    await page.getByRole('button', { name: 'View result' }).click();
    await expect(page.getByRole('heading', { name: 'Ship sunk' })).toBeVisible();
    await expect(page.getByText(`Points · ${clock} · Defeated`)).toBeVisible();
    await expect(page.getByText("Saved to the Captain's Log.")).toBeVisible();
  });
});
