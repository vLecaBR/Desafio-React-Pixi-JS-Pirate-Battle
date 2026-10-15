import { expect, test, type Page } from '@playwright/test';
import type { PerfReport } from '../../src/game/testing/perfMonitor.ts';
import { describeEnvironment, saveResult } from './environment.ts';

/**
 * A full three-minute match in the production build with dense combat
 * (`preset=stress`: one spawn per second, up to 10 enemies). A simple keyboard bot
 * sails, turns and keeps all three weapons firing, so projectiles, effects and
 * enemies stay at their peak. Real time, real input, real rendering.
 */
async function botStep(page: Page, turnRight: boolean) {
  await page.keyboard.up(turnRight ? 'KeyA' : 'KeyD');
  await page.keyboard.down(turnRight ? 'KeyD' : 'KeyA');
}

test('three-minute match: frame rate, frame times and entity counts', async ({ page, browser }) => {
  test.setTimeout(6 * 60_000);
  await page.goto('/?perf=1&preset=stress&seed=3');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__PB__?.state()?.phase === 'running', undefined, {
    timeout: 30_000,
  });

  for (const key of ['KeyW', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.down(key);
  const started = Date.now();
  let turnRight = true;
  while (Date.now() - started < 190_000) {
    await botStep(page, turnRight);
    turnRight = !turnRight;
    await page.waitForTimeout(1500);
    const phase = await page.evaluate(() => window.__PB__?.state()?.phase ?? 'gone');
    if (phase !== 'running') break;
  }
  const report = await page.evaluate(() => window.__PB_PERF__?.report() ?? null);
  const final = await page.evaluate(() => window.__PB__?.state() ?? null);
  expect(report).not.toBeNull();
  if (!report) return;

  const environment = await describeEnvironment(page, browser);
  const file = saveResult('match', {
    kind: 'three-minute-match',
    environment,
    config: { preset: 'stress', seed: 3, sessionTimeSec: 180, spawnIntervalSec: 1, maxAlive: 10 },
    match: final && {
      phase: final.phase,
      elapsedMs: final.elapsedMs,
      score: final.score,
      spawnsSoFar: final.spawnsSoFar,
    },
    report: summarise(report),
    samples: report.samples,
  });
  console.log(`Saved ${file}`);
  console.log(JSON.stringify(summarise(report), null, 2));

  expect(report.durationSec).toBeGreaterThan(170);
  expect(report.entities.ships.max).toBeGreaterThan(5);
});

function summarise(report: PerfReport) {
  const { samples: _samples, ...rest } = report;
  return rest;
}
