import type { ReactNode } from 'react';
import { WoodButton } from '../components/buttons.tsx';
import { formatClock, formatPlayedAt, formatRank } from '../format.ts';

export interface RankingRow {
  readonly matchId: string;
  readonly rank: number;
  readonly playerName: string;
  readonly isYou: boolean;
  readonly score: number;
  readonly playedAt: string;
}

export interface HistoryRow {
  readonly matchId: string;
  readonly playedAt: string;
  readonly score: number;
  readonly durationMs: number;
  readonly endReason: 'time_up' | 'defeated';
  /** Most recent match of this session (highlighted, as in the mockup). */
  readonly highlighted?: boolean;
}

const PAGE_SIZE_SKELETON = 5;

export function RankingTable({
  rows,
  caption,
}: {
  readonly rows: readonly RankingRow[];
  readonly caption: string;
}) {
  return (
    <table className="log-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Captain</th>
          <th scope="col">Points</th>
          <th scope="col">Played</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const played = formatPlayedAt(row.playedAt);
          return (
            <tr key={row.matchId} className={row.isYou ? 'is-highlighted' : undefined}>
              <td data-label="Rank" className="points">
                {formatRank(row.rank)}
              </td>
              <th scope="row" data-label="Captain" className="log-table__captain">
                {row.rank === 1 && (
                  <img
                    src="/assets/png/default/ui/hud/icon_score.png"
                    alt="Top captain"
                    width={20}
                    height={20}
                    className="log-table__star"
                  />
                )}
                {row.playerName}
                {row.isYou && <span className="badge">You</span>}
              </th>
              <td data-label="Points" className="points">
                {row.score}
              </td>
              <td data-label="Played" className="muted">
                {played.day} · {played.time}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function HistoryTable({
  rows,
  caption,
}: {
  readonly rows: readonly HistoryRow[];
  readonly caption: string;
}) {
  return (
    <table className="log-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Points</th>
          <th scope="col">Duration</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const played = formatPlayedAt(row.playedAt);
          return (
            <tr key={row.matchId} className={row.highlighted ? 'is-highlighted' : undefined}>
              <th scope="row" data-label="Date">
                {played.day} <span className="muted">· {played.time}</span>
              </th>
              <td data-label="Points" className="points">
                {row.score}
              </td>
              <td data-label="Duration">{formatClock(row.durationMs / 1000)}</td>
              <td data-label="Result" className={`result-tag--${row.endReason}`}>
                {row.endReason === 'time_up' ? 'Time up' : 'Defeated'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TableSkeleton({ label }: { readonly label: string }) {
  return (
    <table className="log-table" aria-busy="true">
      <caption className="visually-hidden">{label}</caption>
      <tbody>
        {Array.from({ length: PAGE_SIZE_SKELETON }, (_, index) => (
          <tr key={index} className="skeleton-row" aria-hidden="true">
            <td />
            <td />
            <td />
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LogMessage({
  title,
  children,
  onRetry,
  role,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly onRetry?: () => void;
  readonly role?: 'alert' | 'status';
}) {
  return (
    <div className="log-state" role={role}>
      <strong>{title}</strong>
      {children}
      {onRetry && (
        <WoodButton variant="secondary" onClick={onRetry}>
          Retry
        </WoodButton>
      )}
    </div>
  );
}
