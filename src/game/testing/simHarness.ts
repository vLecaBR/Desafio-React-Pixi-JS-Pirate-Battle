import {
  createMatchConfig,
  DEFAULT_MATCH_OPTIONS,
  type ConfigOverrides,
  type GameConfig,
  type MatchOptions,
} from '../config/gameConfig.ts';
import { Simulation, type SimulationSetup } from '../core/Simulation.ts';
import {
  createIntents,
  type MatchResult,
  type PlayerIntents,
  type SimEventMap,
} from '../core/types.ts';
import { autopilot } from './autopilot.ts';

export interface HarnessOptions {
  readonly seed?: number;
  readonly options?: MatchOptions;
  readonly overrides?: ConfigOverrides<GameConfig>;
  readonly setup?: SimulationSetup;
}

export interface RecordedEvent<K extends keyof SimEventMap = keyof SimEventMap> {
  readonly tick: number;
  readonly type: K;
  readonly payload: SimEventMap[K];
}

/** Builds a simulation and records every event with the tick it happened on. */
export function createHarness(harness: HarnessOptions = {}) {
  const config = createMatchConfig(
    harness.options ?? DEFAULT_MATCH_OPTIONS,
    harness.overrides ?? {},
  );
  const sim = new Simulation({
    config,
    seed: harness.seed ?? 1,
    ...(harness.setup ? { setup: harness.setup } : {}),
  });
  const events: RecordedEvent[] = [];
  const types: (keyof SimEventMap)[] = [
    'shotFired',
    'projectileHit',
    'projectileExpired',
    'shipDamaged',
    'enemySpawned',
    'enemyDestroyed',
    'playerDestroyed',
    'scoreChanged',
    'matchEnded',
  ];
  for (const type of types) {
    sim.on(type, (payload) => {
      events.push({ tick: sim.snapshot().ticks, type, payload });
    });
  }

  const intents = createIntents();
  const stepsFor = (seconds: number) => Math.round(seconds / config.sim.fixedStepSec);

  return {
    sim,
    config,
    events,
    /** Events of one type, typed. */
    eventsOf<K extends keyof SimEventMap>(type: K): RecordedEvent<K>[] {
      return events.filter((event): event is RecordedEvent<K> => event.type === type);
    },
    /** Holds the given intents for `seconds` of simulated time. */
    run(seconds: number, held: Partial<PlayerIntents> = {}): void {
      Object.assign(intents, createIntents(), held);
      sim.setIntents(intents);
      for (let i = 0, n = stepsFor(seconds); i < n; i++) sim.step();
    },
    /** Lets the autopilot play for `seconds` (or until the match ends). */
    runAutopilot(seconds: number): void {
      for (let i = 0, n = stepsFor(seconds); i < n; i++) {
        sim.setIntents(autopilot(sim.snapshot(), config, intents));
        if (!sim.step()) break;
      }
    },
    stepsFor,
  };
}

export interface MatchSummary {
  readonly seed: number;
  readonly result: MatchResult | null;
  readonly ticks: number;
  readonly score: number;
  readonly spawnsSoFar: number;
  readonly enemiesAlive: number;
  readonly projectilesAlive: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly heading: number;
    readonly hp: number;
  };
  readonly eventCounts: Readonly<Record<string, number>>;
}

/** Plays a full match with the autopilot and returns a compact, comparable summary. */
export function playAutopilotMatch(harness: HarnessOptions & { seed: number }): MatchSummary {
  const h = createHarness(harness);
  h.runAutopilot(h.config.match.sessionTimeSec + 1);
  const snapshot = h.sim.snapshot();
  const eventCounts: Record<string, number> = {};
  for (const event of h.events) eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const summary: MatchSummary = {
    seed: harness.seed,
    result: h.sim.matchResult,
    ticks: snapshot.ticks,
    score: snapshot.score,
    spawnsSoFar: snapshot.spawnsSoFar,
    enemiesAlive: snapshot.enemies.length,
    projectilesAlive: snapshot.projectiles.length,
    player: {
      x: round(snapshot.player.x),
      y: round(snapshot.player.y),
      heading: round(snapshot.player.heading),
      hp: snapshot.player.hp,
    },
    eventCounts,
  };
  h.sim.destroy();
  return summary;
}
