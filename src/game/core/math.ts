/**
 * Small allocation-free math helpers.
 *
 * Angle convention: ships face up in their sprites, so heading 0 points north
 * (screen up) and positive angles turn clockwise. The forward vector of a heading
 * `h` is `(sin h, -cos h)`; the starboard (right) side is `h + PI/2`.
 */

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(angle: number): number {
  let a = angle % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Signed smallest difference `to - from`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Rotates `current` towards `target` by at most `maxStep` radians. */
export function rotateTowards(current: number, target: number, maxStep: number): number {
  const delta = angleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(delta) * maxStep);
}

/** Heading (in the game's convention) of the vector (dx, dy). */
export function headingOf(dx: number, dy: number): number {
  return Math.atan2(dx, -dy);
}

export function forwardX(heading: number): number {
  return Math.sin(heading);
}

export function forwardY(heading: number): number {
  return -Math.cos(heading);
}

/** Moves `value` towards `target` by at most `maxDelta`. */
export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/**
 * Earliest parameter t in [0, 1] at which the segment p0->p1 touches the circle
 * (cx, cy, r), or `Infinity` when it does not. Returns 0 if p0 starts inside.
 */
export function segmentCircleT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const fx = x0 - cx;
  const fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const a = dx * dx + dy * dy;
  if (a === 0) return Infinity;
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}

/**
 * Earliest parameter t in [0, 1] at which the segment p0->p1 enters the
 * axis-aligned box, or `Infinity`. Returns 0 if p0 starts inside (slab method).
 */
export function segmentAabbT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  let tMin = 0;
  let tMax = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;

  if (dx === 0) {
    if (x0 < minX || x0 > maxX) return Infinity;
  } else {
    let t1 = (minX - x0) / dx;
    let t2 = (maxX - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }

  if (dy === 0) {
    if (y0 < minY || y0 > maxY) return Infinity;
  } else {
    let t1 = (minY - y0) / dy;
    let t2 = (maxY - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

/** Mutable 2D vector used as an output parameter to avoid allocations. */
export interface MutableVec2 {
  x: number;
  y: number;
}

/**
 * Minimum translation that pushes a circle out of an axis-aligned box.
 * Writes the push into `out` and returns true when they overlap.
 */
export function circleAabbPush(
  cx: number,
  cy: number,
  r: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  out: MutableVec2,
): boolean {
  const nearestX = clamp(cx, minX, maxX);
  const nearestY = clamp(cy, minY, maxY);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > 0) {
    if (distSq >= r * r) return false;
    const dist = Math.sqrt(distSq);
    const depth = r - dist;
    out.x = (dx / dist) * depth;
    out.y = (dy / dist) * depth;
    return true;
  }

  // Center inside the box: push out along the axis of least penetration.
  const left = cx - minX;
  const right = maxX - cx;
  const top = cy - minY;
  const bottom = maxY - cy;
  const min = Math.min(left, right, top, bottom);
  out.x = 0;
  out.y = 0;
  if (min === left) out.x = -(left + r);
  else if (min === right) out.x = right + r;
  else if (min === top) out.y = -(top + r);
  else out.y = bottom + r;
  return true;
}

/** Push that separates circle A from circle B (applied to A). */
export function circleCirclePush(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  out: MutableVec2,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const radii = ar + br;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radii * radii) return false;
  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    out.x = radii;
    out.y = 0;
    return true;
  }
  const depth = radii - dist;
  out.x = (dx / dist) * depth;
  out.y = (dy / dist) * depth;
  return true;
}
