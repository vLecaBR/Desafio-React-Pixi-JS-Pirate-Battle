import { expect, test } from './fixtures.ts';
import { advance, setOptions, startMatch, state } from './helpers/game.ts';

test.describe('Enemies and spawning @desktop', () => {
  test('a Chaser pursues, rams the player, explodes and awards no points', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'chaser-ahead' });
    const start = await startMatch(page);
    const chaser = start.enemies[0];
    expect(chaser?.type).toBe('chaser');

    await advance(page, 1000);
    const closer = (await state(page)).enemies[0];
    expect(Math.abs((closer?.x ?? 0) - start.player.x)).toBeLessThan(
      Math.abs((chaser?.x ?? 0) - start.player.x),
    );

    await advance(page, 4000);
    const after = await state(page);
    expect(after.enemies).toHaveLength(0);
    expect(after.player.hp).toBe(75);
    expect(after.score).toBe(0);
  });

  test('a Shooter holds its distance and fires within range', async ({ page, gotoApp }) => {
    await gotoApp({ preset: 'shooter-in-range' });
    await startMatch(page);
    await advance(page, 8000);
    const after = await state(page);
    expect(after.player.hp).toBeLessThan(100);
    const shooter = after.enemies[0];
    expect(shooter?.type).toBe('shooter');
    const distance = Math.hypot(
      (shooter?.x ?? 0) - after.player.x,
      (shooter?.y ?? 0) - after.player.y,
    );
    expect(distance).toBeLessThanOrEqual(360);
    expect(distance).toBeGreaterThan(200);
  });

  test('enemies spawn on the configured interval, far from the player, both types', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp({ preset: 'spawn-test' });
    await setOptions(page, 120, 2);
    const start = await startMatch(page);

    await advance(page, 1400);
    expect((await state(page)).spawnsSoFar).toBe(0);
    await advance(page, 200); // 1.6 s: first spawn at 1.5 s
    let current = await state(page);
    expect(current.spawnsSoFar).toBe(1);
    expect(current.enemies[0]?.type).toBe('chaser');
    const first = current.enemies[0];
    expect(
      Math.hypot((first?.x ?? 0) - start.player.x, (first?.y ?? 0) - start.player.y),
    ).toBeGreaterThanOrEqual(420);

    await advance(page, 1800); // 3.4 s: next spawn only at 3.5 s
    expect((await state(page)).spawnsSoFar).toBe(1);
    await advance(page, 200);
    current = await state(page);
    expect(current.spawnsSoFar).toBe(2);
    expect(current.enemies.some((enemy) => enemy.type === 'shooter')).toBe(true);
  });
});
