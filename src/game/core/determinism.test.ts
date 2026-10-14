import { describe, expect, it } from 'vitest';
import { createHarness, playAutopilotMatch } from '../testing/simHarness.ts';

describe('determinism (headless 120 s matches)', () => {
  it('the same seed and inputs always produce the same match', () => {
    const first = playAutopilotMatch({ seed: 1234 });
    const second = playAutopilotMatch({ seed: 1234 });
    expect(second).toEqual(first);
    expect(first.result).not.toBeNull();
  });

  it('different seeds produce different spawns', () => {
    const spawnsOf = (seed: number) => {
      const h = createHarness({ seed });
      h.runAutopilot(20);
      return h.eventsOf('enemySpawned').map((event) => [event.payload.x, event.payload.y]);
    };
    expect(spawnsOf(1)).not.toEqual(spawnsOf(2));
  });

  it('a default match shows both enemy types and real combat', () => {
    const summary = playAutopilotMatch({ seed: 42 });
    const h = createHarness({ seed: 42 });
    h.runAutopilot(130);
    const kinds = new Set(h.eventsOf('enemySpawned').map((event) => event.payload.kind));
    expect(kinds).toEqual(new Set(['chaser', 'shooter']));
    expect(summary.eventCounts['shotFired'] ?? 0).toBeGreaterThan(10);
    expect(summary.eventCounts['enemyDestroyed'] ?? 0).toBeGreaterThan(0);
    expect(summary.result?.durationMs).toBeGreaterThan(0);
    expect(summary.result?.durationMs).toBeLessThanOrEqual(120_000);
  });
});
