import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMatchesApi } from '../data/api.ts';
import { compareRanking, PAGE_SIZE, type MatchRecord } from '../data/contracts.ts';
import { createHttpClient } from '../data/httpClient.ts';
import { MockDb } from './db.ts';
import { createFixtures } from './fixtures.ts';
import { createHandlers } from './handlers.ts';
import { scenarioStore, setScenario, type ScenarioId } from './scenarios.ts';

const BASE = 'http://pb.test/api';
const player = { playerId: 'player-me', playerName: 'Captain Me' };
const settings = { sessionTimeSec: 120, spawnIntervalSec: 3 };

let db = new MockDb(false);
const server = setupServer(...createHandlers(db, () => player, BASE));

function api(timeoutMs = 2000) {
  return createMatchesApi(createHttpClient({ baseURL: BASE, timeoutMs }));
}

function record(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    matchId: 'match-1',
    playerId: player.playerId,
    playerName: player.playerName,
    playedAt: '2026-10-14T12:00:00.000Z',
    score: 25,
    durationMs: 120_000,
    endReason: 'time_up',
    settings,
    ...overrides,
  };
}

function use(id: ScenarioId) {
  setScenario(id);
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  db = new MockDb(false);
  server.resetHandlers(...createHandlers(db, () => player, BASE));
  scenarioStore.setState({ latencyOverride: 0, seed: 1 });
  use('success');
});
afterEach(() => {
  use('success');
});
afterAll(() => {
  server.close();
});

describe('mock database', () => {
  it('starts from deterministic fixtures with intentional ties', () => {
    const fixtures = createFixtures();
    expect(createFixtures()).toEqual(fixtures);
    expect(fixtures.length).toBeGreaterThanOrEqual(40);
    expect(new Set(fixtures.map((f) => f.playerName)).size).toBeGreaterThanOrEqual(10);
    const ties = fixtures.filter((f) => f.score === 21 && f.settings.sessionTimeSec === 120);
    expect(ties.length).toBeGreaterThanOrEqual(4);
  });

  it('ranks one configuration with the documented tie-break and paginates', () => {
    const page1 = db.ranking(settings, 1, PAGE_SIZE);
    const all = createFixtures()
      .filter((f) => f.settings.sessionTimeSec === 120 && f.settings.spawnIntervalSec === 3)
      .sort(compareRanking);
    expect(page1.totalItems).toBe(all.length);
    expect(page1.totalPages).toBe(Math.ceil(all.length / PAGE_SIZE));
    expect(page1.items.map((i) => i.matchId)).toEqual(all.slice(0, 5).map((f) => f.matchId));
    expect(page1.items.map((i) => i.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('inserts idempotently and bumps the revision only on real writes', () => {
    const before = db.revision;
    expect(db.insert(record()).created).toBe(true);
    expect(db.insert(record({ score: 99 })).created).toBe(false);
    expect(db.count('match-1')).toBe(1);
    expect(db.find('match-1')?.score).toBe(25);
    expect(db.revision).toBe(before + 1);
  });
});

describe('API handlers (Axios client against MSW)', () => {
  it('registers a match once and shows it consistently in ranking and history', async () => {
    const client = api();
    const first = await client.registerMatch(record({ score: 999 }));
    const replay = await client.registerMatch(record({ score: 999 }));
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(db.count('match-1')).toBe(1);

    const ranking = await client.getRanking(settings, 1);
    expect(ranking.items[0]).toMatchObject({ matchId: 'match-1', rank: 1 });
    const history = await client.getHistory(player.playerId, 1);
    expect(history.items.map((i) => i.matchId)).toEqual(['match-1']);
    expect(history.revision).toBe(ranking.revision);
  });

  it('rejects invalid records and idempotency key mismatches', async () => {
    const response = await fetch(`${BASE}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'other' },
      body: JSON.stringify(record()),
    });
    expect(response.status).toBe(400);
    await expect(api().registerMatch({ ...record(), score: -1 })).rejects.toMatchObject({
      kind: 'http',
      status: 422,
    });
  });

  it('empty and many-pages scenarios', async () => {
    use('empty');
    expect((await api().getRanking(settings, 1)).items).toEqual([]);
    expect((await api().getHistory(player.playerId, 1)).totalPages).toBe(0);

    use('many-pages');
    expect((await api().getRanking(settings, 1)).totalPages).toBeGreaterThanOrEqual(4);
    expect((await api().getHistory(player.playerId, 1)).totalPages).toBeGreaterThanOrEqual(2);
  });

  it('read failure scenarios', async () => {
    use('ranking-fails');
    await expect(api().getRanking(settings, 1)).rejects.toMatchObject({ status: 500 });
    await expect(api().getHistory(player.playerId, 1)).resolves.toBeDefined();

    use('history-fails');
    await expect(api().getHistory(player.playerId, 1)).rejects.toMatchObject({ status: 500 });
    await expect(api().getRanking(settings, 1)).resolves.toBeDefined();

    use('http-4xx');
    await expect(api().getRanking(settings, 1)).rejects.toMatchObject({ status: 400 });
    use('http-5xx');
    await expect(api().getRanking(settings, 1)).rejects.toMatchObject({ status: 500 });
    use('network-error');
    await expect(api().getRanking(settings, 1)).rejects.toMatchObject({ kind: 'network' });
    use('timeout');
    await expect(api(100).getRanking(settings, 1)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('timeout after commit: the retry recovers the existing record without duplicates', async () => {
    use('post-timeout-after-commit');
    await expect(api(150).registerMatch(record())).rejects.toMatchObject({ kind: 'timeout' });
    expect(db.count('match-1')).toBe(1); // committed despite the client timeout

    const retry = await api(150).registerMatch(record());
    expect(retry.created).toBe(false);
    expect(db.count('match-1')).toBe(1);
  });

  it('outage on finish: registration fails until the service recovers', async () => {
    use('outage-on-finish');
    await expect(api().registerMatch(record())).rejects.toMatchObject({ status: 503 });
    await expect(api().registerMatch(record())).rejects.toMatchObject({ status: 503 });
    expect(db.count('match-1')).toBe(0);

    use('success');
    await expect(api().registerMatch(record())).resolves.toMatchObject({ created: true });
  });
});
