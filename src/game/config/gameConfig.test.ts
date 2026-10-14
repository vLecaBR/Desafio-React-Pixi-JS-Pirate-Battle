import { describe, expect, it } from 'vitest';
import {
  createMatchConfig,
  DEFAULT_GAME_CONFIG,
  DEFAULT_MATCH_OPTIONS,
  OPTION_LIMITS,
  validateGameConfig,
} from './gameConfig.ts';

describe('gameConfig', () => {
  it('ships a valid default configuration', () => {
    expect(validateGameConfig(DEFAULT_GAME_CONFIG)).toEqual([]);
    expect(DEFAULT_GAME_CONFIG.player.broadside.shots).toBe(3);
  });

  it('keeps the default options within the documented limits', () => {
    const { sessionTimeSec, spawnIntervalSec } = OPTION_LIMITS;
    expect(sessionTimeSec).toMatchObject({ min: 60, max: 180 });
    expect(spawnIntervalSec.min).toBeGreaterThan(0);
    expect(DEFAULT_MATCH_OPTIONS.sessionTimeSec).toBeGreaterThanOrEqual(sessionTimeSec.min);
    expect(DEFAULT_MATCH_OPTIONS.sessionTimeSec).toBeLessThanOrEqual(sessionTimeSec.max);
    expect(DEFAULT_MATCH_OPTIONS.spawnIntervalSec).toBeGreaterThanOrEqual(spawnIntervalSec.min);
    expect(DEFAULT_MATCH_OPTIONS.spawnIntervalSec).toBeLessThanOrEqual(spawnIntervalSec.max);
  });

  it('creates an immutable snapshot that applies the player options', () => {
    const config = createMatchConfig({ sessionTimeSec: 90, spawnIntervalSec: 4.5 });
    expect(config.match.sessionTimeSec).toBe(90);
    expect(config.spawn.intervalSec).toBe(4.5);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.player.frontCannon)).toBe(true);
    expect(Object.isFrozen(config.spawn.guaranteedOpening)).toBe(true);
    // The shared defaults are never mutated.
    expect(DEFAULT_GAME_CONFIG.match.sessionTimeSec).toBe(120);
    expect(Object.isFrozen(DEFAULT_GAME_CONFIG)).toBe(false);
  });

  it('applies deep overrides without touching sibling values', () => {
    const config = createMatchConfig(DEFAULT_MATCH_OPTIONS, {
      player: { frontCannon: { damage: 99 } },
      spawn: { guaranteedOpening: ['shooter'] },
    });
    expect(config.player.frontCannon.damage).toBe(99);
    expect(config.player.frontCannon.cooldownSec).toBe(
      DEFAULT_GAME_CONFIG.player.frontCannon.cooldownSec,
    );
    expect(config.spawn.guaranteedOpening).toEqual(['shooter']);
  });

  it('rejects invalid values', () => {
    expect(() => createMatchConfig({ sessionTimeSec: 120, spawnIntervalSec: 0 })).toThrow(
      /intervalSec/,
    );
    expect(() => createMatchConfig(DEFAULT_MATCH_OPTIONS, { chaser: { moveSpeed: -1 } })).toThrow(
      /chaser.moveSpeed/,
    );
  });
});
