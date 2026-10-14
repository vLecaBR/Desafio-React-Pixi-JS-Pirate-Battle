import { expect, test } from './fixtures.ts';
import { advance, holdKeys, startMatch, state, tapKey } from './helpers/game.ts';

test.describe('Weapons, damage and score @desktop', () => {
  test('front cannon fires one projectile forward and respects its cooldown', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);

    await holdKeys(page, ['Space'], 300);
    let current = await state(page);
    expect(current.projectiles).toBe(1);
    expect(current.projectileList[0]).toMatchObject({ team: 'player', dirX: 1, dirY: 0 });

    // Still held: the next shot only comes after the 0.45 s cooldown.
    await page.keyboard.down('Space');
    await advance(page, 100);
    expect((await state(page)).projectiles).toBe(1);
    await advance(page, 150);
    current = await state(page);
    await page.keyboard.up('Space');
    expect(current.projectiles).toBe(2);
  });

  test('broadsides fire three parallel projectiles to each side with independent cooldowns', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'sandbox' });
    await startMatch(page);

    await tapKey(page, 'KeyE');
    let current = await state(page);
    const right = current.projectileList.filter((p) => p.dirY === 1);
    expect(right).toHaveLength(3); // heading east: starboard is south
    const xs = right.map((p) => p.x).sort((a, b) => a - b);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeCloseTo(22, 0);
    expect((xs[2] ?? 0) - (xs[1] ?? 0)).toBeCloseTo(22, 0);

    await tapKey(page, 'KeyQ');
    current = await state(page);
    expect(current.projectileList.filter((p) => p.dirY === -1)).toHaveLength(3);

    await tapKey(page, 'KeyE'); // right side still cooling down
    expect((await state(page)).projectiles).toBe(6);
  });

  test('a hit applies damage once and a kill scores exactly one point', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'target-practice' });
    await startMatch(page);

    await tapKey(page, 'Space');
    await advance(page, 1500);
    let current = await state(page);
    expect(current.enemies).toHaveLength(1);
    expect(current.enemies[0]?.hp).toBe(25);
    expect(current.projectiles).toBe(0);

    await advance(page, 1000);
    expect((await state(page)).enemies[0]?.hp).toBe(25);

    await tapKey(page, 'Space');
    await advance(page, 1500);
    current = await state(page);
    expect(current.enemies).toHaveLength(0);
    expect(current.score).toBe(1);

    await advance(page, 2000);
    expect((await state(page)).score).toBe(1);
    const status = page.getByRole('region', { name: 'Match status' });
    await expect(status.getByText('Score')).toBeAttached();
    await expect(status.locator('.counter__value').first()).toHaveText('1');
  });
});
