import type { GameConfig } from '../config/gameConfig.ts';
import { angleDelta, headingOf } from '../core/math.ts';
import type { SimSnapshot } from '../core/Simulation.ts';
import type { PlayerIntents } from '../core/types.ts';

const AIM_TOLERANCE_RAD = 0.12;
const BROADSIDE_TOLERANCE_RAD = 0.35;
const TURN_DEADZONE_RAD = 0.04;

/**
 * Deterministic bot used by smoke tests, determinism checks and performance runs.
 * It only produces the same boolean intents a human would (keyboard/touch), so the
 * real movement, weapon and collision rules are exercised.
 */
export function autopilot(
  snapshot: SimSnapshot,
  config: GameConfig,
  out: PlayerIntents,
): PlayerIntents {
  const { player, enemies } = snapshot;
  out.forward = true;
  out.turnLeft = false;
  out.turnRight = false;
  out.fireFront = false;
  out.fireLeft = false;
  out.fireRight = false;
  if (!player.alive) return out;

  let target: (typeof enemies)[number] | null = null;
  let bestDistanceSq = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const distanceSq = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      target = enemy;
    }
  }

  if (!target) {
    // Patrol: gentle constant turn keeps the ship moving around the arena.
    out.turnRight = snapshot.ticks % 240 < 120;
    return out;
  }

  const distance = Math.sqrt(bestDistanceSq);
  const bearing = angleDelta(player.heading, headingOf(target.x - player.x, target.y - player.y));
  out.turnRight = bearing > TURN_DEADZONE_RAD;
  out.turnLeft = bearing < -TURN_DEADZONE_RAD;

  out.fireFront =
    Math.abs(bearing) < AIM_TOLERANCE_RAD && distance < config.player.frontCannon.rangePx;
  const broadsideRange = config.player.broadside.rangePx;
  if (distance < broadsideRange) {
    out.fireRight = Math.abs(bearing - Math.PI / 2) < BROADSIDE_TOLERANCE_RAD;
    out.fireLeft = Math.abs(bearing + Math.PI / 2) < BROADSIDE_TOLERANCE_RAD;
  }
  return out;
}
