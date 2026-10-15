import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { describeEnvironment, saveResult } from './environment.ts';

// Defaults follow the challenge (5 cycles); PERF_CYCLES / PERF_PLAY_MS allow longer
// investigation runs (saved as "memory-extended").
const CYCLES = Number(process.env['PERF_CYCLES'] ?? 5);
const PLAY_MS = Number(process.env['PERF_PLAY_MS'] ?? 30_000);
const EXTENDED = CYCLES !== 5 || PLAY_MS !== 30_000;

interface Metrics {
  readonly cycle: number;
  readonly jsHeapUsedMb: number;
  readonly jsHeapTotalMb: number;
  readonly domNodes: number;
  readonly jsEventListeners: number;
  readonly documents: number;
  readonly canvases: number;
}

async function measure(page: Page, session: CDPSession, cycle: number): Promise<Metrics> {
  // Two collections: the first may only finalise objects freed by the second.
  await session.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(250);
  await session.send('HeapProfiler.collectGarbage');
  const { metrics } = await session.send('Performance.getMetrics');
  const value = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
  const mb = (bytes: number) => Math.round((bytes / 1048576) * 100) / 100;
  return {
    cycle,
    jsHeapUsedMb: mb(value('JSHeapUsedSize')),
    jsHeapTotalMb: mb(value('JSHeapTotalSize')),
    domNodes: value('Nodes'),
    jsEventListeners: value('JSEventListeners'),
    documents: value('Documents'),
    canvases: await page.locator('canvas').count(),
  };
}

/**
 * Five cycles of: main menu -> play 30 s of dense combat -> pause -> main menu.
 * After each cycle the heap is garbage-collected and measured. Resources released
 * on exit (Pixi application, WebGL context, ticker, listeners, pools) must not
 * accumulate: after the warm-up cycles, the numbers must stay flat.
 */
test('memory after five play/exit cycles', async ({ page, browser }) => {
  test.setTimeout(CYCLES * (PLAY_MS + 15_000) + 120_000);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');

  await page.goto('/?perf=1&preset=stress&seed=5');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  const results: Metrics[] = [await measure(page, session, 0)];

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => window.__PB__?.state()?.phase === 'running');
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.down(key);
    await page.waitForTimeout(PLAY_MS);
    for (const key of ['KeyW', 'KeyD', 'Space', 'KeyQ', 'KeyE']) await page.keyboard.up(key);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.waitForTimeout(1000);
    results.push(await measure(page, session, cycle));
  }

  const environment = await describeEnvironment(page, browser);
  const file = saveResult(EXTENDED ? 'memory-extended' : 'memory', {
    kind: 'memory-cycles',
    environment,
    config: { preset: 'stress', seed: 5, cycles: CYCLES, playMsPerCycle: PLAY_MS },
    results,
  });
  console.log(`Saved ${file}`);
  console.table(results);

  // Warm-up (textures, sounds, code) happens in the first cycles; from cycle 2 on
  // the heap must stay within 15 % (+3 MB slack) and nothing else may accumulate.
  const reference = results[2];
  const last = results[CYCLES];
  if (!reference || !last) throw new Error('Missing measurements');
  expect(last.jsHeapUsedMb).toBeLessThanOrEqual(reference.jsHeapUsedMb * 1.15 + 3);
  expect(last.jsEventListeners).toBeLessThanOrEqual(reference.jsEventListeners * 1.05 + 5);
  expect(last.domNodes).toBeLessThanOrEqual(reference.domNodes * 1.05 + 50);
  expect(last.canvases).toBe(0);
  expect(last.documents).toBeLessThanOrEqual(reference.documents);
});
