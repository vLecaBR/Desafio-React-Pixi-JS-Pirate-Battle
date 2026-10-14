import { createStore } from 'zustand/vanilla';
import { Rng } from '../game/core/rng.ts';
import { STORAGE_KEYS } from '../persistence/storage.ts';

/**
 * Reproducible network scenarios for the mocked ranking/history API.
 * Select with `?scenario=<id>` (also remembered in localStorage) or the Network Lab.
 * `?seed=` seeds the random latency; `?latency=` overrides fixed latencies.
 */
export const SCENARIOS = [
  { id: 'success', label: 'Success', description: 'Normal responses after 150 ms.' },
  { id: 'empty', label: 'Empty lists', description: 'Ranking and history return no items.' },
  {
    id: 'many-pages',
    label: 'Many pages',
    description: 'Extra records so both tabs have several pages.',
  },
  { id: 'slow', label: 'Slow', description: 'Every response takes 2.5 s.' },
  {
    id: 'variable-latency',
    label: 'Variable latency',
    description: 'Seeded random latency between 100 ms and 1.8 s.',
  },
  {
    id: 'out-of-order',
    label: 'Out of order',
    description: 'Reads alternate 1.8 s and 0.1 s, so an older request can answer last.',
  },
  {
    id: 'timeout',
    label: 'Timeout',
    description: 'Nothing answers before the client timeout (4 s).',
  },
  { id: 'network-error', label: 'Network error', description: 'Connection failures.' },
  { id: 'http-4xx', label: 'HTTP 4xx', description: 'Reads return 400, registrations 422.' },
  { id: 'http-5xx', label: 'HTTP 5xx', description: 'Reads return 500, registrations 503.' },
  { id: 'ranking-fails', label: 'Ranking fails', description: 'Only the ranking returns 500.' },
  { id: 'history-fails', label: 'History fails', description: 'Only the history returns 500.' },
  {
    id: 'post-timeout-after-commit',
    label: 'Timeout after save',
    description: 'Registrations are saved, then the answer arrives too late (client timeout).',
  },
  {
    id: 'outage-on-finish',
    label: 'Outage on finish',
    description: 'Registrations fail with 503 until another scenario is selected.',
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

const SCENARIO_IDS = new Set<string>(SCENARIOS.map((scenario) => scenario.id));

export function isScenarioId(value: string | null | undefined): value is ScenarioId {
  return typeof value === 'string' && SCENARIO_IDS.has(value);
}

export const LATENCY = {
  success: 150,
  slow: 2500,
  variableMin: 100,
  variableMax: 1800,
  outOfOrderSlow: 1800,
  outOfOrderFast: 100,
  /** Longer than the Axios timeout (4 s) so the client always times out. */
  hang: 10_000,
} as const;

interface ScenarioState {
  readonly scenario: ScenarioId;
  readonly seed: number;
  /** Fixed latency override from `?latency=` (ms), or null. */
  readonly latencyOverride: number | null;
}

function readInitial(): ScenarioState {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('scenario');
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEYS.mockScenario);
  } catch {
    stored = null;
  }
  const scenario = isScenarioId(fromUrl) ? fromUrl : isScenarioId(stored) ? stored : 'success';
  if (isScenarioId(fromUrl)) persistScenario(fromUrl);

  const seed = Number(params.get('seed'));
  const latency = Number(params.get('latency'));
  return {
    scenario,
    seed: Number.isInteger(seed) && seed >= 0 ? seed : 1,
    latencyOverride:
      params.has('latency') && Number.isFinite(latency) && latency >= 0 ? latency : null,
  };
}

function persistScenario(id: ScenarioId): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.mockScenario, id);
  } catch {
    // Best-effort.
  }
}

export const scenarioStore = createStore<ScenarioState>()(() =>
  typeof window === 'undefined'
    ? { scenario: 'success', seed: 1, latencyOverride: null }
    : readInitial(),
);

let rng = new Rng(scenarioStore.getState().seed);
let readCounter = 0;

export function setScenario(id: ScenarioId): void {
  persistScenario(id);
  readCounter = 0;
  scenarioStore.setState({ scenario: id });
}

export function setScenarioSeed(seed: number): void {
  rng = new Rng(seed >>> 0);
  readCounter = 0;
  scenarioStore.setState({ seed: seed >>> 0 });
}

export function currentScenario(): ScenarioId {
  return scenarioStore.getState().scenario;
}

/** Latency for one request under the active scenario (ms). */
export function latencyFor(kind: 'read' | 'write'): number {
  const { scenario, latencyOverride } = scenarioStore.getState();
  switch (scenario) {
    case 'slow':
      return latencyOverride ?? LATENCY.slow;
    case 'variable-latency':
      return Math.round(rng.range(LATENCY.variableMin, LATENCY.variableMax));
    case 'out-of-order':
      if (kind === 'write') return latencyOverride ?? LATENCY.success;
      // Alternating slow/fast reads: the first (slow) request answers after the second.
      return readCounter++ % 2 === 0 ? LATENCY.outOfOrderSlow : LATENCY.outOfOrderFast;
    case 'timeout':
      return LATENCY.hang;
    default:
      return latencyOverride ?? LATENCY.success;
  }
}
