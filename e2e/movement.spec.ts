import { expect, test } from './fixtures.ts';
import { holdKeys, startMatch, state } from './helpers/game.ts';

const HULL_REACH = 24 + 20; // hull offset + collision radius (default config)

test.describe('Match start and movement', () => {
  test('starts a match and sails forward along the heading', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    const start = await startMatch(page);
    expect(start).toMatchObject({ phase: 'running', score: 0, elapsedMs: 0 });
    expect(start.player.hp).toBe(100);
    await expect(page.locator('canvas')).toHaveCount(1);

    await holdKeys(page, ['KeyW'], 1000);
    const moved = await state(page);
    // Default heading is east: x grows, y stays.
    expect(moved.player.x - start.player.x).toBeGreaterThan(60);
    expect(Math.abs(moved.player.y - start.player.y)).toBeLessThan(0.5);
    expect(moved.player.heading).toBeCloseTo(start.player.heading, 5);
  });

  test('rotates both ways, also while moving and firing', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'sandbox' });
    const start = await startMatch(page);

    await holdKeys(page, ['KeyD'], 500);
    const right = await state(page);
    expect(right.player.heading - start.player.heading).toBeCloseTo(1.3, 1);

    await holdKeys(page, ['ArrowLeft'], 500);
    expect((await state(page)).player.heading).toBeCloseTo(start.player.heading, 1);

    await holdKeys(page, ['KeyW', 'KeyA', 'Space'], 600);
    const combo = await state(page);
    expect(combo.player.heading).toBeLessThan(start.player.heading);
    expect(
      Math.hypot(combo.player.x - start.player.x, combo.player.y - start.player.y),
    ).toBeGreaterThan(20);
    expect(combo.projectiles).toBeGreaterThan(0);
  });

  test('islands block the ship', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'island-ahead' });
    const start = await startMatch(page);
    await holdKeys(page, ['KeyW'], 3000);
    const after = await state(page);
    // Heading south towards the center island, whose shoreline is at y = 324.
    expect(after.player.y).toBeGreaterThan(start.player.y + 30);
    expect(after.player.y + HULL_REACH).toBeLessThanOrEqual(324.5);
  });

  test('the ship cannot leave the arena', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'near-edge' });
    await startMatch(page);
    await holdKeys(page, ['KeyW'], 3000);
    const after = await state(page);
    expect(after.player.x + HULL_REACH).toBeLessThanOrEqual(1280.5);
    expect(after.player.x).toBeGreaterThan(1200);
  });
});
