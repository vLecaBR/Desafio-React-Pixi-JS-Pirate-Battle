import { useOptionsStore } from '../../persistence/optionsStore.ts';
import { LogMessage } from './LogTables.tsx';

/**
 * Ranking and Match History tab contents. The data layer (Axios + TanStack Query
 * + MSW) is connected in the data phase; until then both tabs show their empty
 * state.
 */
export function RankingPanel() {
  const options = useOptionsStore((state) => state.options);
  return (
    <>
      <p className="log__subtitle">
        {options.sessionTimeSec} second battles · {options.spawnIntervalSec} second spawn interval
      </p>
      <LogMessage title="No battles recorded yet" role="status">
        <span>Finish a battle to claim your place in the ranking.</span>
      </LogMessage>
    </>
  );
}

export function HistoryPanel() {
  return (
    <>
      <p className="log__subtitle">Your recent battles</p>
      <LogMessage title="No battles recorded yet" role="status">
        <span>Your completed battles will appear here.</span>
      </LogMessage>
    </>
  );
}
