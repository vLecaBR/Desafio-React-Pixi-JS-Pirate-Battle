import { forwardX, forwardY, type MutableVec2 } from '../math.ts';
import type { Ship } from '../types.ts';
import type { CollisionGrid } from '../world/collisionGrid.ts';

/**
 * Ships collide as two circles: bow (index 0) and stern (index 1), at
 * `±hullOffset` from the center along the heading.
 */
export function hullCircleX(ship: Ship, index: 0 | 1): number {
  const sign = index === 0 ? 1 : -1;
  return ship.x + forwardX(ship.heading) * ship.hullOffset * sign;
}

export function hullCircleY(ship: Ship, index: 0 | 1): number {
  const sign = index === 0 ? 1 : -1;
  return ship.y + forwardY(ship.heading) * ship.hullOffset * sign;
}

export const HULL_CIRCLES = [0, 1] as const;

const push: MutableVec2 = { x: 0, y: 0 };

/** Pushes the ship out of islands, rocks and the arena edges (slides along them). */
export function resolveShipAgainstStatics(
  ship: Ship,
  grid: CollisionGrid,
  iterations: number,
): void {
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const index of HULL_CIRCLES) {
      if (
        grid.resolveCircle(hullCircleX(ship, index), hullCircleY(ship, index), ship.radius, push)
      ) {
        ship.x += push.x;
        ship.y += push.y;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** True when any hull circle of `a` overlaps any hull circle of `b` (plus `slop`). */
export function shipsTouch(a: Ship, b: Ship, slop = 0): boolean {
  const reach = a.radius + b.radius + slop;
  const reachSq = reach * reach;
  for (const i of HULL_CIRCLES) {
    const ax = hullCircleX(a, i);
    const ay = hullCircleY(a, i);
    for (const j of HULL_CIRCLES) {
      const dx = hullCircleX(b, j) - ax;
      const dy = hullCircleY(b, j) - ay;
      if (dx * dx + dy * dy < reachSq) return true;
    }
  }
  return false;
}
