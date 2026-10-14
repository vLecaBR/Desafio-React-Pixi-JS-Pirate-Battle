/**
 * Deterministic pseudo-random number generator (mulberry32).
 * The simulation never uses `Math.random()`: same seed => same match.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Current internal state; can be used to resume the sequence. */
  get seed(): number {
    return this.state;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Picks a key with probability proportional to its weight. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
    let roll = this.next() * total;
    for (const [key, weight] of entries) {
      roll -= Math.max(0, weight);
      if (roll < 0) return key;
    }
    const last = entries[entries.length - 1];
    if (!last) throw new Error('weighted() requires at least one entry');
    return last[0];
  }
}

/** Derives a 32-bit seed from an arbitrary string (FNV-1a). */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
