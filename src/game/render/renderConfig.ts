/**
 * Purely visual tuning (no gameplay impact). Gameplay values live in GameConfig.
 * Durations in seconds, distances in world pixels.
 */
export const RENDER = {
  background: 0x2a8fb8,
  /** Drift of the water texture, px/s, for a bit of life. */
  waterDrift: { x: 6, y: 3 },
  /** Shallow-water halo drawn around islands. */
  shallows: { padding: 26, radius: 34, alpha: 0.22 },
  /** Area outside the arena (letterbox): darker water and a thin border. */
  outside: { color: 0x05202e, alpha: 0.45, borderAlpha: 0.35 },

  healthBar: { scale: 0.55, offsetY: -66, lowRatio: 0.35 },

  ship: {
    hitFlashSec: 0.12,
    hitTint: 0xff8a7a,
    /** Fire appears below this health ratio; a second flame below the next one. */
    fireBelow: [0.5, 0.25] as const,
    fireFlickerSec: 0.12,
    sinkSec: 1.8,
  },

  projectile: { trailLength: 46, trailWidth: 2.5, trailAlpha: 0.55 },

  effects: {
    muzzleFlashSec: 0.14,
    muzzleFlashScale: 0.42,
    splashSec: 0.45,
    impactSec: 0.3,
    explosionSec: 0.5,
    debrisSec: 0.75,
    debrisSpeed: 110,
  },

  shake: { playerHit: 6, playerDestroyed: 12, decayPerSec: 30 },
} as const;
