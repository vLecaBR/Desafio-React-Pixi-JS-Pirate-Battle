import type { MutableVec2 } from '../math.ts';
import type { CollisionGrid } from './collisionGrid.ts';

const UNREACHABLE = -1;

/** 8-connected neighbourhood: [dCol, dRow, cost x10]. */
const NEIGHBOURS = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [1, -1, 14],
  [-1, 1, 14],
  [-1, -1, 14],
] as const;

/**
 * Navigation field towards a single target (the player), computed with Dijkstra
 * over the 20 x 12 tile grid. Enemies follow the downhill neighbour, which lets
 * them go around islands without getting stuck. Diagonal moves never cut obstacle
 * corners. Rebuilt periodically by the AI system, so its cost is amortised.
 */
export class FlowField {
  private readonly cost: Int32Array;
  private readonly queue: Int32Array;
  private readonly settled: Uint8Array;
  private targetCol = -1;
  private targetRow = -1;

  constructor(private readonly grid: CollisionGrid) {
    const size = grid.cols * grid.rows;
    this.cost = new Int32Array(size).fill(UNREACHABLE);
    this.queue = new Int32Array(size * 8 + 1);
    this.settled = new Uint8Array(size);
  }

  get target(): { col: number; row: number } {
    return { col: this.targetCol, row: this.targetRow };
  }

  rebuild(targetX: number, targetY: number): void {
    const { cols } = this.grid;
    const col = this.grid.colOf(targetX);
    const row = this.grid.rowOf(targetY);
    if (col === this.targetCol && row === this.targetRow) return;
    this.targetCol = col;
    this.targetRow = row;
    this.cost.fill(UNREACHABLE);
    this.settled.fill(0);

    // Small grid and small integer costs: a linear-scan Dijkstra is fast enough
    // and keeps the implementation allocation-free.
    let queueLength = 0;
    const start = row * cols + col;
    this.cost[start] = 0;
    this.queue[queueLength++] = start;

    while (queueLength > 0) {
      let bestIndex = 0;
      let bestCost = Infinity;
      for (let i = 0; i < queueLength; i++) {
        const cell = this.queue[i] ?? 0;
        const c = this.cost[cell] ?? 0;
        if (c < bestCost) {
          bestCost = c;
          bestIndex = i;
        }
      }
      const current = this.queue[bestIndex] ?? 0;
      this.queue[bestIndex] = this.queue[--queueLength] ?? 0;
      if (this.settled[current]) continue;
      this.settled[current] = 1;

      const cc = current % cols;
      const cr = Math.floor(current / cols);
      for (const [dc, dr, step] of NEIGHBOURS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!this.canStep(cc, cr, dc, dr)) continue;
        const next = nr * cols + nc;
        const nextCost = bestCost + step;
        const known = this.cost[next] ?? UNREACHABLE;
        if (known === UNREACHABLE || nextCost < known) {
          this.cost[next] = nextCost;
          this.queue[queueLength++] = next;
        }
      }
    }
  }

  /** Path cost (x10 per tile) from the cell to the target, or -1 if unreachable. */
  costAt(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.grid.cols || row >= this.grid.rows) return UNREACHABLE;
    return this.cost[row * this.grid.cols + col] ?? UNREACHABLE;
  }

  /**
   * Writes the center of the next cell towards the target into `out`.
   * Returns false when the position is already in the target cell or no path exists.
   */
  nextWaypoint(x: number, y: number, out: MutableVec2): boolean {
    const col = this.grid.colOf(x);
    const row = this.grid.rowOf(y);
    const here = this.costAt(col, row);
    if (here === 0) return false;

    let bestCost = here === UNREACHABLE ? Infinity : here;
    let bestCol = -1;
    let bestRow = -1;
    for (const [dc, dr] of NEIGHBOURS) {
      // Ships may be pushed into a blocked cell's margin; allow leaving it.
      if (here !== UNREACHABLE && !this.canStep(col, row, dc, dr)) continue;
      const c = this.costAt(col + dc, row + dr);
      if (c !== UNREACHABLE && c < bestCost) {
        bestCost = c;
        bestCol = col + dc;
        bestRow = row + dr;
      }
    }
    if (bestCol < 0) return false;
    out.x = (bestCol + 0.5) * this.grid.tileSize;
    out.y = (bestRow + 0.5) * this.grid.tileSize;
    return true;
  }

  private canStep(col: number, row: number, dc: number, dr: number): boolean {
    if (this.grid.isBlockedCell(col + dc, row + dr)) return false;
    if (dc !== 0 && dr !== 0) {
      // No corner cutting: both orthogonal neighbours must be free.
      if (this.grid.isBlockedCell(col + dc, row) || this.grid.isBlockedCell(col, row + dr)) {
        return false;
      }
    }
    return true;
  }
}
