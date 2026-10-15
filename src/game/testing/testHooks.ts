import type { GameController } from '../GameController.ts';

/**
 * Test instrumentation, enabled only with `?e2e=1`.
 *
 * In this mode the ticker only renders; the simulation advances exclusively through
 * `window.__PB__.advance(ms)`, which runs the real fixed steps (rules, input,
 * collisions) and renders a frame. Tests can therefore control time precisely while
 * still driving the game through real keyboard and touch events.
 */

export interface TestStateSnapshot {
  readonly phase: string;
  readonly paused: boolean;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly score: number;
  readonly endReason: string | null;
  readonly spawnsSoFar: number;
  readonly player: {
    x: number;
    y: number;
    heading: number;
    hp: number;
    alive: boolean;
    speed: number;
  };
  readonly enemies: { id: number; type: string; x: number; y: number; hp: number }[];
  readonly projectiles: number;
  readonly projectileList: { team: string; x: number; y: number; dirX: number; dirY: number }[];
}

export interface TestHooks {
  state(): TestStateSnapshot | null;
  advance(ms: number): number;
  stats(): unknown;
}

declare global {
  interface Window {
    __PB__?: TestHooks;
    /** Network Lab actions (reset, counts), exposed only in test mode. */
    __PB_LAB__?: unknown;
  }
}

const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);

export const isTestMode = params?.get('e2e') === '1';

/** Profiling mode (`?perf=1`): real clock, but the state hooks are available. */
export const isPerfMode = params?.get('perf') === '1';

/** Fixed seed requested through `?seed=` (test and demo reproducibility). */
export const requestedSeed: number | null = (() => {
  const raw = params?.get('seed');
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value >>> 0 : null;
})();

let current: GameController | null = null;

// `|| 0` normalises -0 so snapshots compare equal with Object.is.
const round = (value: number) => Math.round(value * 100) / 100 || 0;

const hooks: TestHooks = {
  state() {
    if (!current) return null;
    const sim = current.simulation;
    const s = sim.snapshot();
    return {
      phase: s.phase,
      paused: current.isPaused,
      elapsedMs: Math.round(s.elapsedSec * 1000),
      remainingMs: Math.round(s.remainingSec * 1000),
      score: s.score,
      endReason: s.endReason,
      spawnsSoFar: s.spawnsSoFar,
      player: {
        x: round(s.player.x),
        y: round(s.player.y),
        heading: round(s.player.heading),
        hp: s.player.hp,
        alive: s.player.alive,
        speed: round(s.player.speed),
      },
      enemies: s.enemies.map((e) => ({
        id: e.id,
        type: e.kind,
        x: round(e.x),
        y: round(e.y),
        hp: e.hp,
      })),
      projectiles: s.projectiles.length,
      projectileList: s.projectiles.map((p) => ({
        team: p.team,
        x: round(p.x),
        y: round(p.y),
        dirX: round(p.dirX),
        dirY: round(p.dirY),
      })),
    };
  },
  advance(ms) {
    return current ? current.advance(ms / 1000) : 0;
  },
  stats() {
    return current?.rendererStats ?? null;
  },
};

/** Registers the active controller (or clears it with null). No-op outside test mode. */
export function setTestController(controller: GameController | null): void {
  if (!isTestMode && !isPerfMode) return;
  current = controller;
  window.__PB__ = hooks;
}

/** Exposes the Network Lab actions to end-to-end tests (test mode only). */
export function exposeLabActions(actions: unknown): void {
  if (isTestMode) window.__PB_LAB__ = actions;
}
