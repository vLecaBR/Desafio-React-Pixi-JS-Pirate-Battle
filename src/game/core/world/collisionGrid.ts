import {
  circleAabbPush,
  circleCirclePush,
  clamp,
  segmentAabbT,
  segmentCircleT,
  type MutableVec2,
} from '../math.ts';
import type { GameMap, StaticCollider } from './map.ts';

/**
 * Spatial index of the static obstacles (islands and rocks) plus the arena bounds.
 *
 * Each grid cell stores the colliders overlapping it, so queries only test the few
 * colliders near the query shape. The arena edges behave as solid walls.
 * All queries are allocation-free.
 */
export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly widthPx: number;
  readonly heightPx: number;

  private readonly colliders: readonly StaticCollider[];
  private readonly cellColliders: number[][];
  /** Cells that navigation must avoid (an obstacle covers the cell center area). */
  private readonly blocked: Uint8Array;
  /** Per-collider query stamps used to de-duplicate colliders spanning several cells. */
  private readonly stamps: Uint32Array;
  private stamp = 0;
  private readonly push: MutableVec2 = { x: 0, y: 0 };

  constructor(map: GameMap) {
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.widthPx;
    this.heightPx = map.heightPx;
    this.colliders = map.colliders;
    this.cellColliders = Array.from({ length: this.cols * this.rows }, () => []);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.stamps = new Uint32Array(this.colliders.length);

    this.colliders.forEach((collider, index) => {
      const [minX, minY, maxX, maxY] = bounds(collider);
      const c0 = this.colOf(minX);
      const c1 = this.colOf(maxX);
      const r0 = this.rowOf(minY);
      const r1 = this.rowOf(maxY);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          this.cellColliders[r * this.cols + c]?.push(index);
          if (this.coversCellCenter(collider, c, r)) this.blocked[r * this.cols + c] = 1;
        }
      }
    });
  }

  colOf(x: number): number {
    return clamp(Math.floor(x / this.tileSize), 0, this.cols - 1);
  }

  rowOf(y: number): number {
    return clamp(Math.floor(y / this.tileSize), 0, this.rows - 1);
  }

  isBlockedCell(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
    return this.blocked[row * this.cols + col] === 1;
  }

  /**
   * Accumulated displacement that moves the circle out of every obstacle and back
   * inside the arena. Returns true when any correction was needed.
   */
  resolveCircle(x: number, y: number, r: number, out: MutableVec2): boolean {
    let px = x;
    let py = y;
    this.forEachNear(px - r, py - r, px + r, py + r, (collider) => {
      const hit =
        collider.kind === 'box'
          ? circleAabbPush(
              px,
              py,
              r,
              collider.minX,
              collider.minY,
              collider.maxX,
              collider.maxY,
              this.push,
            )
          : circleCirclePush(px, py, r, collider.x, collider.y, collider.r, this.push);
      if (hit) {
        px += this.push.x;
        py += this.push.y;
      }
      return false;
    });
    px = clamp(px, r, this.widthPx - r);
    py = clamp(py, r, this.heightPx - r);
    out.x = px - x;
    out.y = py - y;
    return out.x !== 0 || out.y !== 0;
  }

  /** True when the circle overlaps an obstacle or leaves the arena. */
  overlapsCircle(x: number, y: number, r: number): boolean {
    if (x - r < 0 || y - r < 0 || x + r > this.widthPx || y + r > this.heightPx) return true;
    return this.forEachNear(x - r, y - r, x + r, y + r, (collider) =>
      collider.kind === 'box'
        ? circleAabbPush(
            x,
            y,
            r,
            collider.minX,
            collider.minY,
            collider.maxX,
            collider.maxY,
            this.push,
          )
        : circleCirclePush(x, y, r, collider.x, collider.y, collider.r, this.push),
    );
  }

  /**
   * Earliest parameter t in [0, 1] where the segment touches an obstacle,
   * or `Infinity` when the path is clear. Arena bounds are not considered.
   */
  segmentT(x0: number, y0: number, x1: number, y1: number): number {
    let best = Infinity;
    this.forEachNear(
      Math.min(x0, x1),
      Math.min(y0, y1),
      Math.max(x0, x1),
      Math.max(y0, y1),
      (collider) => {
        const t =
          collider.kind === 'box'
            ? segmentAabbT(
                x0,
                y0,
                x1,
                y1,
                collider.minX,
                collider.minY,
                collider.maxX,
                collider.maxY,
              )
            : segmentCircleT(x0, y0, x1, y1, collider.x, collider.y, collider.r);
        if (t < best) best = t;
        return false;
      },
    );
    return best;
  }

  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.segmentT(x0, y0, x1, y1) === Infinity;
  }

  /**
   * Visits each collider whose cells overlap the query box once.
   * Stops early when the visitor returns true; returns whether it stopped.
   */
  private forEachNear(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    visit: (collider: StaticCollider) => boolean,
  ): boolean {
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      this.stamps.fill(0);
      this.stamp = 1;
    }
    const c0 = this.colOf(minX);
    const c1 = this.colOf(maxX);
    const r0 = this.rowOf(minY);
    const r1 = this.rowOf(maxY);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const list = this.cellColliders[r * this.cols + c];
        if (!list) continue;
        for (const index of list) {
          if (this.stamps[index] === this.stamp) continue;
          this.stamps[index] = this.stamp;
          const collider = this.colliders[index];
          if (collider && visit(collider)) return true;
        }
      }
    }
    return false;
  }

  private coversCellCenter(collider: StaticCollider, col: number, row: number): boolean {
    // A cell is blocked for navigation when the obstacle reaches its central half.
    const quarter = this.tileSize / 4;
    const cx = (col + 0.5) * this.tileSize;
    const cy = (row + 0.5) * this.tileSize;
    if (collider.kind === 'box') {
      return (
        cx >= collider.minX && cx <= collider.maxX && cy >= collider.minY && cy <= collider.maxY
      );
    }
    return circleAabbPush(
      collider.x,
      collider.y,
      collider.r,
      cx - quarter,
      cy - quarter,
      cx + quarter,
      cy + quarter,
      this.push,
    );
  }
}

function bounds(collider: StaticCollider): [number, number, number, number] {
  return collider.kind === 'box'
    ? [collider.minX, collider.minY, collider.maxX, collider.maxY]
    : [
        collider.x - collider.r,
        collider.y - collider.r,
        collider.x + collider.r,
        collider.y + collider.r,
      ];
}
