import { delay, http, HttpResponse } from 'msw';
import {
  API_BASE_URL,
  API_ROUTES,
  IDEMPOTENCY_HEADER,
  matchRecordSchema,
  matchSettingsSchema,
  type ApiErrorBody,
  type MatchRecord,
} from '../data/contracts.ts';
import type { MockDb } from './db.ts';
import { createManyPagesFixtures } from './fixtures.ts';
import { currentScenario, LATENCY, latencyFor } from './scenarios.ts';

const MAX_PAGE_SIZE = 50;

function errorResponse(status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return HttpResponse.json(body, { status });
}

function emptyPage(paging: { page: number; pageSize: number }, revision: number) {
  return { items: [], ...paging, totalItems: 0, totalPages: 0, revision };
}

function readPaging(url: URL): { page: number; pageSize: number } | null {
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '5');
  if (!Number.isInteger(page) || page < 1) return null;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) return null;
  return { page, pageSize };
}

/** Failure injected for reads by the active scenario, or null to answer normally. */
function readFailure(resource: 'ranking' | 'history') {
  switch (currentScenario()) {
    case 'network-error':
      return HttpResponse.error();
    case 'http-4xx':
      return errorResponse(400, 'bad_request', 'The request parameters were rejected.');
    case 'http-5xx':
      return errorResponse(500, 'internal_error', 'Unexpected server error.');
    case 'ranking-fails':
      return resource === 'ranking'
        ? errorResponse(500, 'ranking_unavailable', 'The ranking is unavailable.')
        : null;
    case 'history-fails':
      return resource === 'history'
        ? errorResponse(500, 'history_unavailable', 'The match history is unavailable.')
        : null;
    default:
      return null;
  }
}

/**
 * MSW handlers for the ranking and match-history API. They share the contracts
 * (zod schemas) with the client and run on top of the persisted mock database, so
 * confirmed registrations show up in both tabs. Each handler applies the active
 * network scenario (latency, failures, timeouts).
 */
export function createHandlers(
  db: MockDb,
  getPlayer: () => { playerId: string; playerName: string },
  baseUrl: string = API_BASE_URL,
) {
  const url = (path: string) => `${baseUrl}${path}`;

  return [
    http.get(url(API_ROUTES.ranking), async ({ request }) => {
      await delay(latencyFor('read'));
      const failure = readFailure('ranking');
      if (failure) return failure;

      const params = new URL(request.url);
      const paging = readPaging(params);
      const settings = matchSettingsSchema.safeParse({
        sessionTimeSec: Number(params.searchParams.get('sessionTimeSec')),
        spawnIntervalSec: Number(params.searchParams.get('spawnIntervalSec')),
      });
      if (!paging || !settings.success) {
        return errorResponse(400, 'invalid_query', 'Invalid ranking parameters.');
      }
      const scenario = currentScenario();
      if (scenario === 'empty') {
        return HttpResponse.json(emptyPage(paging, db.revision));
      }
      const extra =
        scenario === 'many-pages' ? createManyPagesFixtures(settings.data, getPlayer()) : [];
      return HttpResponse.json(db.ranking(settings.data, paging.page, paging.pageSize, extra));
    }),

    http.get(url(API_ROUTES.playerMatchesPattern), async ({ request, params }) => {
      await delay(latencyFor('read'));
      const failure = readFailure('history');
      if (failure) return failure;

      const playerId = typeof params['playerId'] === 'string' ? params['playerId'] : '';
      const paging = readPaging(new URL(request.url));
      if (!paging || playerId === '') {
        return errorResponse(400, 'invalid_query', 'Invalid history parameters.');
      }
      const scenario = currentScenario();
      if (scenario === 'empty') {
        return HttpResponse.json(emptyPage(paging, db.revision));
      }
      const player = getPlayer();
      const extra =
        scenario === 'many-pages' && player.playerId === playerId
          ? createManyPagesFixtures({ sessionTimeSec: 120, spawnIntervalSec: 3 }, player)
          : [];
      return HttpResponse.json(db.history(playerId, paging.page, paging.pageSize, extra));
    }),

    http.post(url(API_ROUTES.matches), async ({ request }) => {
      const scenario = currentScenario();
      if (scenario === 'network-error') return HttpResponse.error();
      if (scenario === 'timeout') {
        await delay(LATENCY.hang);
        return errorResponse(504, 'timeout', 'The request timed out.');
      }
      await delay(latencyFor('write'));
      if (scenario === 'http-5xx' || scenario === 'outage-on-finish') {
        return errorResponse(503, 'unavailable', 'The match service is temporarily unavailable.');
      }

      const body: unknown = await request.json().catch(() => null);
      const parsed = matchRecordSchema.safeParse(body);
      if (scenario === 'http-4xx' || !parsed.success) {
        return errorResponse(422, 'invalid_record', 'The match record is invalid.');
      }
      const record: MatchRecord = parsed.data;
      if (request.headers.get(IDEMPOTENCY_HEADER) !== record.matchId) {
        return errorResponse(
          400,
          'idempotency_key_mismatch',
          'Idempotency-Key must match matchId.',
        );
      }

      const result = db.insert(record);
      if (scenario === 'post-timeout-after-commit' && result.created) {
        // The record is committed, but the answer arrives after the client gave up.
        await delay(LATENCY.hang);
      }
      return HttpResponse.json(result, { status: result.created ? 201 : 200 });
    }),
  ];
}
