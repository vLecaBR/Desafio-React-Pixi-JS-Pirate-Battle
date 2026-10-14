import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { describeApiError } from '../../data/apiError.ts';
import type { HistoryPage, MatchSettings, RankingPage } from '../../data/contracts.ts';
import { getLocalPlayer } from '../../data/player.ts';
import { useHistoryQuery, useRankingQuery } from '../../data/queries.ts';
import { OPTION_LIMITS, type NumericLimit } from '../../game/config/gameConfig.ts';
import { useLastResultStore } from '../../persistence/lastResultStore.ts';
import { useOptionsStore } from '../../persistence/optionsStore.ts';
import { Pagination } from '../components/Pagination.tsx';
import { HistoryTable, LogMessage, RankingTable, TableSkeleton } from './LogTables.tsx';

/**
 * Renders the common query states: first load (skeleton), error without data
 * (message + Retry), empty, data, background refresh indicator and a failed
 * background refresh (data kept, discreet message).
 */
function QueryView<T extends { items: readonly unknown[]; page: number; totalPages: number }>({
  query,
  label,
  emptyText,
  page,
  onPage,
  children,
}: {
  readonly query: UseQueryResult<T>;
  readonly label: string;
  readonly emptyText: string;
  readonly page: number;
  readonly onPage: (page: number) => void;
  readonly children: (data: T) => ReactNode;
}) {
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = query;
  const retry = () => {
    void refetch();
  };

  // Keep the page inside the range after the data changed (e.g. fewer pages).
  const totalPages = data?.totalPages ?? 0;
  useEffect(() => {
    if (data && totalPages > 0 && page > totalPages) onPage(totalPages);
  }, [data, totalPages, page, onPage]);

  if (isPending) {
    return (
      <>
        <p className="visually-hidden" role="status">
          Loading {label.toLowerCase()}…
        </p>
        <TableSkeleton label={`Loading ${label.toLowerCase()}`} />
      </>
    );
  }

  if (!data) {
    return (
      <LogMessage title={`${label} could not be loaded`} role="alert" onRetry={retry}>
        <span>{describeApiError(error)}</span>
      </LogMessage>
    );
  }

  if (data.items.length === 0) {
    return (
      <LogMessage title="No battles recorded yet" role="status">
        <span>{emptyText}</span>
      </LogMessage>
    );
  }

  return (
    <>
      <div
        aria-busy={isFetching}
        className={isPlaceholderData ? 'log__content is-stale' : 'log__content'}
      >
        {children(data)}
      </div>
      <p className="refresh-indicator" role="status">
        {isFetching ? 'Updating…' : ''}
        {isError && !isFetching && (
          <>
            Could not refresh ({describeApiError(error)}).{' '}
            <button type="button" className="text-button" onClick={retry}>
              Retry
            </button>
          </>
        )}
      </p>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        label={`${label} pages`}
        disabled={isPlaceholderData}
        onChange={onPage}
      />
    </>
  );
}

function values(limit: NumericLimit): number[] {
  const result: number[] = [];
  for (let value = limit.min; value <= limit.max + 1e-9; value += limit.step) {
    result.push(Math.round(value * 100) / 100);
  }
  return result;
}

/** Ranking of the selected configuration (defaults to the current options). */
export function RankingPanel() {
  const options = useOptionsStore((state) => state.options);
  const [settings, setSettings] = useState<MatchSettings>({
    sessionTimeSec: options.sessionTimeSec,
    spawnIntervalSec: options.spawnIntervalSec,
  });
  const [page, setPage] = useState(1);
  const query = useRankingQuery(settings, page);
  const playerId = getLocalPlayer().playerId;
  const sessionId = useId();
  const spawnId = useId();

  const change = (next: Partial<MatchSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
    setPage(1);
  };

  return (
    <>
      <p className="log__subtitle">
        {settings.sessionTimeSec} second battles · {settings.spawnIntervalSec} second spawn interval
      </p>
      <div className="log-filters">
        <label htmlFor={sessionId}>
          Battle length
          <select
            id={sessionId}
            value={settings.sessionTimeSec}
            onChange={(event) => {
              change({ sessionTimeSec: Number(event.target.value) });
            }}
          >
            {values(OPTION_LIMITS.sessionTimeSec).map((value) => (
              <option key={value} value={value}>
                {value} s
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={spawnId}>
          Spawn interval
          <select
            id={spawnId}
            value={settings.spawnIntervalSec}
            onChange={(event) => {
              change({ spawnIntervalSec: Number(event.target.value) });
            }}
          >
            {values(OPTION_LIMITS.spawnIntervalSec).map((value) => (
              <option key={value} value={value}>
                {value} s
              </option>
            ))}
          </select>
        </label>
      </div>
      <QueryView<RankingPage>
        query={query}
        label="Ranking"
        emptyText="No battles with this configuration yet. Finish one to claim the top spot."
        page={page}
        onPage={setPage}
      >
        {(data) => (
          <RankingTable
            caption={`Ranking, page ${data.page} of ${data.totalPages}`}
            rows={data.items.map((entry) => ({
              matchId: entry.matchId,
              rank: entry.rank,
              playerName: entry.playerName,
              isYou: entry.playerId === playerId,
              score: entry.score,
              playedAt: entry.playedAt,
            }))}
          />
        )}
      </QueryView>
    </>
  );
}

/** Match history of the local player, most recent first. */
export function HistoryPanel() {
  const [page, setPage] = useState(1);
  const player = getLocalPlayer();
  const query = useHistoryQuery(player.playerId, page);
  const lastMatchId = useLastResultStore((state) => state.lastResult?.matchId ?? null);

  return (
    <>
      <p className="log__subtitle">{player.playerName} · Your recent battles</p>
      <QueryView<HistoryPage>
        query={query}
        label="Match history"
        emptyText="Your completed battles will appear here."
        page={page}
        onPage={setPage}
      >
        {(data) => (
          <HistoryTable
            caption={`Match history, page ${data.page} of ${data.totalPages}`}
            rows={data.items.map((record) => ({
              matchId: record.matchId,
              playedAt: record.playedAt,
              score: record.score,
              durationMs: record.durationMs,
              endReason: record.endReason,
              highlighted: record.matchId === lastMatchId,
            }))}
          />
        )}
      </QueryView>
    </>
  );
}
