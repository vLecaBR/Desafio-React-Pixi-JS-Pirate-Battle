import { QueryClient } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMatchesApi, type MatchesApi } from './api.ts';
import { ApiError, describeApiError, isRetryable, toApiError } from './apiError.ts';
import { compareRanking, IDEMPOTENCY_HEADER, type MatchRecord } from './contracts.ts';
import { createHttpClient } from './httpClient.ts';
import { createPendingStore } from './pendingStore.ts';
import { keepNewest } from './queries.ts';
import { createRetryDelay, retryPolicy } from './queryClient.ts';
import { queryKeys } from './queryKeys.ts';
import { createRegistrationService } from './registration.ts';

function record(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    matchId: 'm-1',
    playerId: 'p-1',
    playerName: 'Captain Jack',
    playedAt: '2026-09-08T19:36:00.000Z',
    score: 24,
    durationMs: 120_000,
    endReason: 'time_up',
    settings: { sessionTimeSec: 120, spawnIntervalSec: 3 },
    ...overrides,
  };
}

function axiosError(code: string | undefined, status?: number, data?: unknown) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response =
    status === undefined ? undefined : { status, statusText: '', data, headers: {}, config };
  return new AxiosError('failed', code, config, undefined, response);
}

describe('ApiError normalisation and retry policy', () => {
  it('classifies timeouts, network failures, HTTP errors and contract errors', () => {
    expect(toApiError(axiosError('ECONNABORTED')).kind).toBe('timeout');
    expect(toApiError(axiosError('ERR_NETWORK')).kind).toBe('network');
    const http = toApiError(
      axiosError('ERR_BAD_RESPONSE', 503, { error: { code: 'unavailable', message: 'Down' } }),
    );
    expect(http).toMatchObject({ kind: 'http', status: 503, code: 'unavailable', message: 'Down' });
    expect(toApiError(new ApiError('contract', 'bad')).kind).toBe('contract');
  });

  it('retries only transient failures', () => {
    expect(isRetryable(new ApiError('timeout', ''))).toBe(true);
    expect(isRetryable(new ApiError('network', ''))).toBe(true);
    expect(isRetryable(new ApiError('http', '', 503))).toBe(true);
    expect(isRetryable(new ApiError('http', '', 429))).toBe(true);
    expect(isRetryable(new ApiError('http', '', 400))).toBe(false);
    expect(isRetryable(new ApiError('http', '', 422))).toBe(false);
    expect(isRetryable(new ApiError('contract', ''))).toBe(false);
    expect(isRetryable(new ApiError('canceled', ''))).toBe(false);
    expect(retryPolicy(0, new ApiError('timeout', ''))).toBe(true);
    expect(retryPolicy(2, new ApiError('timeout', ''))).toBe(false);
  });

  it('describes failures for the UI', () => {
    expect(describeApiError(new ApiError('http', 'x', 500))).toMatch(/unavailable/);
    expect(describeApiError(new ApiError('timeout', ''))).toMatch(/too long/);
  });

  it('uses bounded exponential backoff with (seedable) jitter', () => {
    const delay = createRetryDelay(() => 0.5);
    expect(delay(0)).toBe(300);
    expect(delay(1)).toBe(600);
    expect(delay(10)).toBe(3000);
    const low = createRetryDelay(() => 0);
    expect(low(1)).toBe(400);
  });
});

describe('matches API over Axios', () => {
  function apiWith(adapter: (config: InternalAxiosRequestConfig) => unknown) {
    const client = createHttpClient({ timeoutMs: 50 });
    const calls: InternalAxiosRequestConfig[] = [];
    client.defaults.adapter = async (config) => {
      calls.push(config);
      const result = await Promise.resolve(adapter(config));
      return result as never;
    };
    return { api: createMatchesApi(client), calls };
  }

  const ok = (config: InternalAxiosRequestConfig, data: unknown, status = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  });

  it('sends the idempotency key and validates the response', async () => {
    const sent = record();
    const { api, calls } = apiWith((config) => ok(config, { record: sent, created: true }, 201));
    await expect(api.registerMatch(sent)).resolves.toEqual({ record: sent, created: true });
    expect(new AxiosHeaders(calls[0]?.headers).get(IDEMPOTENCY_HEADER)).toBe('m-1');
  });

  it('passes ranking filters and paging, and rejects malformed payloads as contract errors', async () => {
    const { api, calls } = apiWith((config) => ok(config, { items: 'nope' }));
    await expect(
      api.getRanking({ sessionTimeSec: 90, spawnIntervalSec: 2.5 }, 2),
    ).rejects.toMatchObject({ kind: 'contract' });
    expect(calls[0]?.params).toEqual({
      sessionTimeSec: 90,
      spawnIntervalSec: 2.5,
      page: 2,
      pageSize: 5,
    });
  });

  it('turns HTTP failures into ApiError', async () => {
    const { api } = apiWith(() => {
      throw axiosError('ERR_BAD_REQUEST', 422, {
        error: { code: 'invalid', message: 'Bad record' },
      });
    });
    await expect(api.getHistory('p-1', 1)).rejects.toMatchObject({ kind: 'http', status: 422 });
  });
});

describe('stale response guard', () => {
  it('never replaces newer cached data with an older revision', () => {
    const newer = { revision: 5, items: ['new'] };
    const older = { revision: 3, items: ['old'] };
    expect(keepNewest(newer, older)).toBe(newer);
    expect(keepNewest(older, newer)).toBe(newer);
    expect(keepNewest(undefined, older)).toBe(older);
  });
});

describe('ranking tie-break', () => {
  it('orders by score, then longer survival, then earlier date, then id', () => {
    const rows = [
      record({ matchId: 'd', score: 10, durationMs: 60_000 }),
      record({ matchId: 'c', score: 10, durationMs: 90_000, playedAt: '2026-09-08T20:00:00.000Z' }),
      record({ matchId: 'b', score: 10, durationMs: 90_000, playedAt: '2026-09-08T19:00:00.000Z' }),
      record({ matchId: 'a', score: 10, durationMs: 90_000, playedAt: '2026-09-08T19:00:00.000Z' }),
      record({ matchId: 'e', score: 30 }),
    ];
    expect([...rows].sort(compareRanking).map((row) => row.matchId)).toEqual([
      'e',
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('registration service', () => {
  function setup(api: Partial<MatchesApi>) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const pending = createPendingStore(false);
    const saved: string[] = [];
    const service = createRegistrationService({
      queryClient,
      api: {
        getRanking: () => Promise.reject(new Error('unused')),
        getHistory: () => Promise.reject(new Error('unused')),
        registerMatch: () => Promise.reject(new Error('unused')),
        ...api,
      },
      pending,
      onSaved: (r) => saved.push(r.matchId),
    });
    return { service, pending, invalidate, saved };
  }

  it('queues the record before sending, then removes it and refreshes both tabs on success', async () => {
    let queuedDuringRequest = false;
    const { service, pending, invalidate, saved } = setup({
      registerMatch: (r) => {
        queuedDuringRequest = pending.get(r.matchId) !== undefined;
        return Promise.resolve({ record: r, created: true });
      },
    });
    await expect(service.submit(record())).resolves.toBe(true);
    expect(queuedDuringRequest).toBe(true);
    expect(pending.entries).toHaveLength(0);
    expect(saved).toEqual(['m-1']);
    expect(service.statusOf('m-1', false)).toBe('saved');
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.rankingAll, queryKeys.historyAll]);
  });

  it('keeps failed records pending with the error, and a retry succeeds with the same match id', async () => {
    const register = vi
      .fn<MatchesApi['registerMatch']>()
      .mockRejectedValueOnce(new ApiError('timeout', 'slow'))
      .mockImplementationOnce((r) => Promise.resolve({ record: r, created: false }));
    const { service, pending } = setup({ registerMatch: register });

    await expect(service.submit(record())).resolves.toBe(false);
    expect(pending.get('m-1')).toMatchObject({ attempts: 1 });
    expect(pending.get('m-1')?.lastError).toMatch(/too long/);
    expect(service.statusOf('m-1', false)).toBe('pending');

    await expect(service.retry('m-1')).resolves.toBe(true);
    expect(register.mock.calls.map(([r]) => r.matchId)).toEqual(['m-1', 'm-1']);
    expect(pending.entries).toHaveLength(0);
  });

  it('never runs two requests for the same match at once (repeated Retry clicks)', async () => {
    let resolve: (() => void) | undefined;
    const register = vi.fn<MatchesApi['registerMatch']>(
      (r) =>
        new Promise((done) => {
          resolve = () => {
            done({ record: r, created: true });
          };
        }),
    );
    const { service } = setup({ registerMatch: register });
    const first = service.submit(record());
    const second = service.submit(record());
    const third = service.retry('m-1');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(service.statusOf('m-1', false)).toBe('saving');
    await vi.waitFor(() => {
      expect(resolve).toBeDefined();
    });
    resolve?.();
    await first;
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('flush re-sends every queued record', async () => {
    const register = vi.fn<MatchesApi['registerMatch']>((r) =>
      Promise.resolve({ record: r, created: true }),
    );
    const { service, pending } = setup({ registerMatch: register });
    pending.add(record({ matchId: 'a' }));
    pending.add(record({ matchId: 'b' }));
    await service.flush();
    expect(register.mock.calls.map(([r]) => r.matchId).sort()).toEqual(['a', 'b']);
    expect(pending.entries).toHaveLength(0);
  });
});
