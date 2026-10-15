import { expect, test } from './fixtures.ts';
import { holdKeys, startMatch, state } from './helpers/game.ts';

/**
 * Deliberately failing test, used only to produce the sample failure trace in
 * reports/traces/ (`FORCE_FAIL_DEMO=1 npx playwright test demo-failure`). It is
 * skipped in every normal run.
 */
test('sample failure trace (demo) @desktop', async ({ page, gotoApp }) => {
  test.skip(!process.env['FORCE_FAIL_DEMO'], 'Only runs with FORCE_FAIL_DEMO=1');
  await gotoApp({ preset: 'sandbox' });
  await startMatch(page);
  await holdKeys(page, ['KeyW'], 1000);
  // Wrong on purpose: the ship has moved, so this assertion fails and keeps a trace.
  expect((await state(page)).player.x).toBe(400);
});
