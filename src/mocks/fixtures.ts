import type { MatchRecord } from '../data/contracts.ts';
import { Rng } from '../game/core/rng.ts';

/**
 * Deterministic fixtures representing other players (and a few configurations).
 * Generated from a fixed seed with fixed dates, so every reset produces exactly
 * the same data. Ties are included on purpose to demonstrate the tie-break.
 */

export const FIXTURE_CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Black Annie',
  'Iron Hook',
  'Salty Pete',
  'Lady Marlow',
  'One-Eyed Finn',
  'Grey Gull',
  'Coral Queen',
  'Tide Breaker',
] as const;

const BASE_TIME = Date.parse('2026-09-01T18:00:00.000Z');
const HOUR = 3_600_000;

const CONFIGS = [
  { sessionTimeSec: 120, spawnIntervalSec: 3, count: 22 },
  { sessionTimeSec: 60, spawnIntervalSec: 2, count: 8 },
  { sessionTimeSec: 180, spawnIntervalSec: 5, count: 6 },
  { sessionTimeSec: 90, spawnIntervalSec: 3, count: 4 },
] as const;

function fixtureId(index: number): string {
  return `fixture-${String(index).padStart(3, '0')}`;
}

function captainId(index: number): string {
  return `fixture-player-${String(index).padStart(2, '0')}`;
}

export function createFixtures(): MatchRecord[] {
  const rng = new Rng(2026);
  const records: MatchRecord[] = [];
  let index = 0;

  for (const config of CONFIGS) {
    for (let i = 0; i < config.count; i++) {
      const captain = rng.int(FIXTURE_CAPTAINS.length);
      const defeated = rng.next() < 0.35;
      const fullMs = config.sessionTimeSec * 1000;
      const durationMs = defeated
        ? Math.round((fullMs * rng.range(0.3, 0.95)) / 1000) * 1000
        : fullMs;
      records.push({
        matchId: fixtureId(index),
        playerId: captainId(captain),
        playerName: FIXTURE_CAPTAINS[captain] ?? 'Captain Flint',
        playedAt: new Date(BASE_TIME + index * 5.5 * HOUR).toISOString(),
        score: Math.round(rng.range(4, 38) * (durationMs / fullMs)),
        durationMs,
        endReason: defeated ? 'defeated' : 'time_up',
        settings: {
          sessionTimeSec: config.sessionTimeSec,
          spawnIntervalSec: config.spawnIntervalSec,
        },
      });
      index++;
    }
  }

  // Intentional ties in the default configuration (120 s / 3 s):
  // same score, different duration -> longer survival ranks first;
  // same score and duration -> earlier date ranks first;
  // fully identical except id -> id decides.
  const tie = (
    offset: number,
    captain: number,
    durationMs: number,
    playedAt: string,
  ): MatchRecord => ({
    matchId: fixtureId(index + offset),
    playerId: captainId(captain),
    playerName: FIXTURE_CAPTAINS[captain] ?? 'Captain Flint',
    playedAt,
    score: 21,
    durationMs,
    endReason: durationMs === 120_000 ? 'time_up' : 'defeated',
    settings: { sessionTimeSec: 120, spawnIntervalSec: 3 },
  });
  records.push(
    tie(0, 2, 120_000, '2026-09-07T20:00:00.000Z'),
    tie(1, 3, 98_000, '2026-09-07T19:00:00.000Z'),
    tie(2, 6, 120_000, '2026-09-06T10:00:00.000Z'),
    tie(3, 9, 120_000, '2026-09-06T10:00:00.000Z'),
  );
  return records;
}

/**
 * Extra records used by the `many-pages` scenario: enough to fill several pages of
 * the requested ranking configuration and of the requesting player's history.
 */
export function createManyPagesFixtures(
  settings: { sessionTimeSec: number; spawnIntervalSec: number },
  player: { playerId: string; playerName: string },
): MatchRecord[] {
  const rng = new Rng(77);
  const records: MatchRecord[] = [];
  for (let i = 0; i < 24; i++) {
    const own = i % 2 === 0;
    const captain = rng.int(FIXTURE_CAPTAINS.length);
    records.push({
      matchId: `many-${String(i).padStart(3, '0')}`,
      playerId: own ? player.playerId : captainId(captain),
      playerName: own ? player.playerName : (FIXTURE_CAPTAINS[captain] ?? 'Captain Flint'),
      playedAt: new Date(BASE_TIME - (i + 1) * 7 * HOUR).toISOString(),
      score: 1 + rng.int(30),
      durationMs: settings.sessionTimeSec * 1000,
      endReason: 'time_up',
      settings,
    });
  }
  return records;
}
