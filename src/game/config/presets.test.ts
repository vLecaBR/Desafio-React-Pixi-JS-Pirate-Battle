import { describe, expect, it } from 'vitest';
import { Simulation } from '../core/Simulation.ts';
import { CollisionGrid } from '../core/world/collisionGrid.ts';
import { createMatchConfig, DEFAULT_MATCH_OPTIONS } from './gameConfig.ts';
import { PRESETS } from './presets.ts';

describe('test presets', () => {
  it.each(Object.entries(PRESETS))(
    '%s builds a valid match with ships on open water',
    (_, preset) => {
      const config = createMatchConfig(DEFAULT_MATCH_OPTIONS, preset.overrides);
      const sim = new Simulation({
        config,
        seed: 1,
        ...('setup' in preset ? { setup: preset.setup } : {}),
      });
      const grid = new CollisionGrid(sim.map);
      const { player, enemies } = sim.snapshot();
      for (const ship of [player, ...enemies]) {
        expect(grid.overlapsCircle(ship.x, ship.y, ship.radius)).toBe(false);
      }
      sim.step();
      expect(sim.phase).toBe('running');
    },
  );
});
