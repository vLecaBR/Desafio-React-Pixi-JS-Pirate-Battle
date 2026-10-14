/**
 * Headless smoke test of the simulation core (no browser, no PixiJS, no React).
 *
 * Plays full 120 s matches with the deterministic autopilot, prints a summary and
 * verifies that replaying the same seed produces exactly the same match.
 *
 * Usage: npm run sim:smoke [-- <seed> ...]
 */
import { performance } from 'node:perf_hooks';
import { playAutopilotMatch } from '../src/game/testing/simHarness.ts';

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
if (seeds.length === 0) seeds.push(1, 2, 3);

let failed = false;
for (const seed of seeds) {
  const started = performance.now();
  const first = playAutopilotMatch({ seed });
  const elapsedMs = performance.now() - started;
  const replay = playAutopilotMatch({ seed });
  const deterministic = JSON.stringify(first) === JSON.stringify(replay);
  failed ||= !deterministic;

  const { result, eventCounts } = first;
  console.log(
    [
      `seed ${seed}:`,
      `${result?.endReason ?? 'running'} after ${((result?.durationMs ?? 0) / 1000).toFixed(2)} s,`,
      `score ${first.score}, player hp ${first.player.hp},`,
      `spawned ${first.spawnsSoFar}, alive ${first.enemiesAlive},`,
      `shots ${eventCounts['shotFired'] ?? 0}, hits ${eventCounts['projectileHit'] ?? 0},`,
      `simulated in ${elapsedMs.toFixed(0)} ms,`,
      deterministic ? 'deterministic: yes' : 'deterministic: NO',
    ].join(' '),
  );
}

if (failed) {
  console.error('Determinism check failed.');
  process.exitCode = 1;
}
