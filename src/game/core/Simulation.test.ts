import { describe, expect, it } from 'vitest';
import { createHarness } from '../testing/simHarness.ts';
import { forwardX, forwardY } from './math.ts';

/** No automatic spawns: the scenario fully controls the enemies. */
const SANDBOX = { spawn: { maxAlive: 0 } } as const;
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const SOUTH = Math.PI;

describe('player movement', () => {
  it('sails forward along its heading only while the forward intent is held', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 640, y: 160, heading: EAST } },
    });
    h.run(1, { forward: true });
    const { player } = h.sim.snapshot();
    expect(player.x).toBeGreaterThan(700);
    expect(player.y).toBeCloseTo(160, 5);

    const x = player.x;
    h.run(2); // released: decelerates to a stop
    expect(h.sim.snapshot().player.speed).toBe(0);
    expect(h.sim.snapshot().player.x).toBeGreaterThan(x);
  });

  it('turns both ways at the configured turn speed, also while moving', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 640, y: 160, heading: 0 } },
    });
    h.run(0.5, { turnRight: true, forward: true });
    expect(h.sim.snapshot().player.heading).toBeCloseTo(h.config.player.turnSpeedRad * 0.5, 5);
    h.run(0.5, { turnLeft: true });
    expect(h.sim.snapshot().player.heading).toBeCloseTo(0, 5);
  });

  it('is blocked by islands', () => {
    // The center island's top shoreline is at y = 324.
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 640, y: 200, heading: SOUTH } },
    });
    h.run(3, { forward: true });
    const { player } = h.sim.snapshot();
    const bowY = player.y + forwardY(player.heading) * player.hullOffset;
    expect(bowY + player.radius).toBeLessThanOrEqual(324 + 1e-6);
  });

  it('cannot leave the arena', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 1150, y: 400, heading: EAST } },
    });
    h.run(3, { forward: true });
    const { player } = h.sim.snapshot();
    const bowX = player.x + forwardX(player.heading) * player.hullOffset;
    expect(bowX + player.radius).toBeLessThanOrEqual(1280 + 1e-6);
  });
});

describe('player weapons', () => {
  it('front cannon fires one projectile forward and respects its cooldown', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 400, y: 160, heading: EAST } },
    });
    h.run(0.3, { fireFront: true });
    const first = h.eventsOf('shotFired');
    expect(first).toHaveLength(1);
    expect(first[0]?.payload.weapon).toBe('front');
    expect(first[0]?.payload.projectileIds).toHaveLength(1);
    const projectile = h.sim.snapshot().projectiles[0];
    expect(projectile?.dirX).toBeCloseTo(1, 6);
    expect(projectile?.dirY).toBeCloseTo(0, 6);

    // 0.3 s + 0.2 s > 0.45 s cooldown: exactly one more shot.
    h.run(0.2, { fireFront: true });
    expect(h.eventsOf('shotFired')).toHaveLength(2);
    const ticks = h.eventsOf('shotFired').map((event) => event.tick);
    expect((ticks[1] ?? 0) - (ticks[0] ?? 0)).toBe(
      h.stepsFor(h.config.player.frontCannon.cooldownSec),
    );
  });

  it('broadsides fire three parallel projectiles to the correct side, with independent cooldowns', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 640, y: 400, heading: EAST } },
    });
    h.sim.setIntents({ ...noIntents(), fireRight: true });
    h.sim.step();
    let projectiles = h.sim.snapshot().projectiles;
    expect(projectiles).toHaveLength(3);
    for (const p of projectiles) {
      // Heading east: starboard (right) is south.
      expect(p.dirX).toBeCloseTo(0, 6);
      expect(p.dirY).toBeCloseTo(1, 6);
      expect(p.y).toBeGreaterThan(400);
    }
    const xs = projectiles.map((p) => p.x).sort((a, b) => a - b);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeCloseTo(h.config.player.broadside.spacingPx, 6);
    expect((xs[2] ?? 0) - (xs[1] ?? 0)).toBeCloseTo(h.config.player.broadside.spacingPx, 6);

    // The right side is cooling down, the left side is not.
    h.sim.setIntents({ ...noIntents(), fireRight: true, fireLeft: true });
    h.sim.step();
    projectiles = h.sim.snapshot().projectiles;
    expect(projectiles).toHaveLength(6);
    expect(projectiles.filter((p) => p.dirY < -0.99)).toHaveLength(3);
    expect(h.eventsOf('shotFired').map((event) => event.payload.weapon)).toEqual([
      'broadsideRight',
      'broadsideLeft',
    ]);
  });

  it('projectiles expire at their maximum range', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 300, y: 160, heading: EAST } },
    });
    h.sim.setIntents({ ...noIntents(), fireFront: true });
    h.sim.step();
    h.run(2);
    const expired = h.eventsOf('projectileExpired');
    expect(expired).toHaveLength(1);
    expect(expired[0]?.payload.reason).toBe('range');
    const travelled =
      (expired[0]?.payload.x ?? 0) - (300 + h.config.player.frontCannon.muzzleOffsetPx);
    expect(travelled).toBeCloseTo(h.config.player.frontCannon.rangePx, 3);
    expect(h.sim.snapshot().projectiles).toHaveLength(0);
  });

  it('islands stop projectiles and protect ships behind them', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 640, y: 160, heading: SOUTH },
        enemies: [{ kind: 'shooter', x: 640, y: 560, heading: 0, graceSec: 99 }],
      },
    });
    h.sim.setIntents({ ...noIntents(), fireFront: true });
    h.sim.step();
    h.run(1);
    const hits = h.eventsOf('projectileHit');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.payload.target).toBe('obstacle');
    expect(h.eventsOf('shipDamaged')).toHaveLength(0);
  });
});

describe('damage and score', () => {
  it('applies a projectile hit exactly once and removes the projectile', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 400, y: 160, heading: EAST },
        enemies: [{ kind: 'shooter', x: 760, y: 160, heading: 0, graceSec: 99 }],
      },
    });
    h.sim.setIntents({ ...noIntents(), fireFront: true });
    h.sim.step();
    h.run(1.5);
    const damage = h.eventsOf('shipDamaged');
    expect(damage).toHaveLength(1);
    expect(damage[0]?.payload.amount).toBe(h.config.player.frontCannon.damage);
    expect(h.sim.snapshot().enemies[0]?.hp).toBe(
      h.config.shooter.maxHealth - h.config.player.frontCannon.damage,
    );
    expect(h.sim.snapshot().projectiles).toHaveLength(0);
    expect(h.sim.snapshot().score).toBe(0);
  });

  it('awards one point per enemy destroyed by the player, never twice', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 640, y: 160, heading: EAST },
        // Two enemies in the broadside line, both one hit from destruction.
        enemies: [
          { kind: 'shooter', x: 640, y: 300, heading: 0, hp: 5, graceSec: 99 },
          { kind: 'shooter', x: 900, y: 160, heading: 0, hp: 5, graceSec: 99 },
        ],
      },
    });
    h.sim.setIntents({ ...noIntents(), fireRight: true, fireFront: true });
    h.sim.step();
    h.run(2);
    const destroyed = h.eventsOf('enemyDestroyed');
    expect(destroyed).toHaveLength(2);
    expect(destroyed.every((event) => event.payload.killedBy === 'player')).toBe(true);
    expect(h.sim.snapshot().score).toBe(2);
    expect(h.eventsOf('scoreChanged').map((event) => event.payload.score)).toEqual([1, 2]);
    expect(h.sim.snapshot().enemies).toHaveLength(0);
  });
});

describe('enemies', () => {
  it('Chaser pursues, rams the player once, explodes and awards no points', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 400, y: 160, heading: EAST },
        enemies: [{ kind: 'chaser', x: 900, y: 160, heading: EAST, graceSec: 0 }],
      },
    });
    h.run(8);
    const destroyed = h.eventsOf('enemyDestroyed');
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]?.payload.killedBy).toBe('self');
    expect(h.sim.snapshot().player.hp).toBe(
      h.config.player.maxHealth - h.config.chaser.contactDamage,
    );
    expect(h.eventsOf('shipDamaged')).toHaveLength(1);
    expect(h.eventsOf('shipDamaged')[0]?.payload.source).toBe('contact');
    expect(h.sim.snapshot().score).toBe(0);
    expect(h.sim.snapshot().enemies).toHaveLength(0);
  });

  it('Chaser navigates around an island to reach the player', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        // The center island sits between them.
        player: { x: 640, y: 520, heading: EAST },
        enemies: [{ kind: 'chaser', x: 640, y: 200, heading: SOUTH, graceSec: 0 }],
      },
    });
    h.run(15);
    expect(h.eventsOf('enemyDestroyed')[0]?.payload.killedBy).toBe('self');
  });

  it('Shooter approaches, holds its distance and only fires within range', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 300, y: 160, heading: 0 },
        enemies: [{ kind: 'shooter', x: 900, y: 160, heading: WEST, graceSec: 0 }],
      },
    });
    const cfg = h.config.shooter;
    h.run(1);
    expect(h.eventsOf('shotFired')).toHaveLength(0); // ~530 px away: out of range

    h.run(12);
    const shots = h.eventsOf('shotFired').filter((event) => event.payload.team === 'enemy');
    expect(shots.length).toBeGreaterThan(1);
    const enemy = h.sim.snapshot().enemies[0];
    const distance = Math.hypot((enemy?.x ?? 0) - 300, (enemy?.y ?? 0) - 160);
    expect(distance).toBeLessThanOrEqual(cfg.attackRangePx);
    expect(distance).toBeGreaterThan(cfg.preferredDistancePx * 0.75);
    expect(h.sim.snapshot().player.hp).toBeLessThan(h.config.player.maxHealth);

    // Consecutive shots respect the cannon cooldown.
    for (let i = 1; i < shots.length; i++) {
      expect((shots[i]?.tick ?? 0) - (shots[i - 1]?.tick ?? 0)).toBeGreaterThanOrEqual(
        h.stepsFor(cfg.cannon.cooldownSec),
      );
    }
  });

  it('destroyed enemies stop firing and their shells in flight are removed', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 300, y: 160, heading: EAST, hp: 100 },
        enemies: [{ kind: 'shooter', x: 600, y: 160, heading: WEST, hp: 5, graceSec: 0 }],
      },
    });
    // Let the Shooter fire first, then sink it.
    while (h.eventsOf('shotFired').length === 0) h.sim.step();
    h.sim.setIntents({ ...noIntents(), fireFront: true });
    h.sim.step();
    h.run(2);
    expect(h.eventsOf('enemyDestroyed')).toHaveLength(1);
    const enemyShots = h.eventsOf('shotFired').filter((event) => event.payload.team === 'enemy');
    expect(enemyShots).toHaveLength(1);
    expect(h.sim.snapshot().projectiles).toHaveLength(0);
  });
});

describe('spawner', () => {
  it('spawns on the configured interval, guarantees both types and keeps a safe distance', () => {
    const h = createHarness({ seed: 7, options: { sessionTimeSec: 120, spawnIntervalSec: 2 } });
    const distances: number[] = [];
    h.sim.on('enemySpawned', (event) => {
      const { player } = h.sim.snapshot();
      distances.push(Math.hypot(event.x - player.x, event.y - player.y));
    });
    h.run(9.95);
    const spawns = h.eventsOf('enemySpawned');
    const expectedTicks = [1.5, 3.5, 5.5, 7.5, 9.5].map((seconds) => h.stepsFor(seconds));
    expect(spawns.map((event) => event.tick)).toEqual(expectedTicks);
    expect(spawns.slice(0, 2).map((event) => event.payload.kind)).toEqual(['chaser', 'shooter']);
    for (const distance of distances) {
      expect(distance).toBeGreaterThanOrEqual(h.config.spawn.minDistanceFromPlayer);
    }
  });

  it('never exceeds maxAlive and never spawns on obstacles', () => {
    const h = createHarness({
      seed: 3,
      options: { sessionTimeSec: 120, spawnIntervalSec: 1 },
      overrides: { spawn: { maxAlive: 3 } },
      setup: { player: { hp: 100 } },
    });
    for (let i = 0; i < h.stepsFor(30); i++) {
      h.sim.step();
      expect(h.sim.snapshot().enemies.length).toBeLessThanOrEqual(3);
    }
    expect(h.eventsOf('enemySpawned').length).toBeGreaterThanOrEqual(3);
  });
});

describe('match rules', () => {
  it('ends by time with the exact active duration and freezes everything', () => {
    const h = createHarness({
      options: { sessionTimeSec: 60, spawnIntervalSec: 3 },
      overrides: SANDBOX,
      setup: { enemies: [{ kind: 'shooter', x: 1100, y: 600, heading: 0, graceSec: 999 }] },
    });
    h.run(61, { forward: true, turnRight: true, fireFront: true });
    expect(h.sim.phase).toBe('ended');
    expect(h.eventsOf('matchEnded')).toHaveLength(1);
    expect(h.sim.matchResult).toMatchObject({ durationMs: 60_000, endReason: 'time_up' });

    const before = JSON.stringify(h.sim.snapshot());
    const eventCount = h.events.length;
    h.run(5, { forward: true, fireFront: true, fireLeft: true });
    expect(h.sim.step()).toBe(false);
    expect(JSON.stringify(h.sim.snapshot())).toBe(before);
    expect(h.events).toHaveLength(eventCount);
  });

  it('ends when the player is destroyed and stops scoring', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: {
        player: { x: 400, y: 160, heading: EAST, hp: 20 },
        enemies: [{ kind: 'chaser', x: 700, y: 160, heading: WEST, graceSec: 0 }],
      },
    });
    h.run(5);
    expect(h.sim.matchResult?.endReason).toBe('defeated');
    expect(h.eventsOf('playerDestroyed')).toHaveLength(1);
    expect(h.eventsOf('matchEnded')).toHaveLength(1);
    expect(h.sim.snapshot().player.hp).toBe(0);
    expect(h.sim.matchResult?.durationMs).toBeLessThan(5000);
  });

  it('a new simulation starts from a clean state', () => {
    const first = createHarness({ seed: 9 });
    first.runAutopilot(30);
    const second = createHarness({ seed: 9 });
    const snapshot = second.sim.snapshot();
    expect(snapshot.ticks).toBe(0);
    expect(snapshot.score).toBe(0);
    expect(snapshot.enemies).toHaveLength(0);
    expect(snapshot.projectiles).toHaveLength(0);
    expect(snapshot.player.hp).toBe(second.config.player.maxHealth);
    expect(snapshot.remainingSec).toBe(second.config.match.sessionTimeSec);
  });

  it('clearIntents releases every held control', () => {
    const h = createHarness({
      overrides: SANDBOX,
      setup: { player: { x: 640, y: 160, heading: EAST } },
    });
    h.sim.setIntents({ ...noIntents(), forward: true, fireFront: true });
    h.sim.clearIntents();
    for (let i = 0; i < 30; i++) h.sim.step();
    expect(h.sim.snapshot().player.x).toBe(640);
    expect(h.eventsOf('shotFired')).toHaveLength(0);
  });
});

function noIntents() {
  return {
    forward: false,
    turnLeft: false,
    turnRight: false,
    fireFront: false,
    fireLeft: false,
    fireRight: false,
  };
}
