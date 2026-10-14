import { useScreenStore } from '../../app/screenStore.ts';
import { useLastResultStore } from '../../persistence/lastResultStore.ts';
import { WoodButton } from '../components/buttons.tsx';
import { MenuLayout } from '../components/MenuLayout.tsx';
import { RegistrationStatusLine } from '../components/RegistrationStatus.tsx';
import { formatClock } from '../format.ts';
import { useFocusOnMount } from '../hooks/useFocusOnMount.ts';

/**
 * Result of the last completed match. The result is persisted locally, so it can
 * be reopened from the main menu after a refresh.
 */
export function ResultScreen() {
  const result = useLastResultStore((state) => state.lastResult);
  const startMatch = useScreenStore((state) => state.startMatch);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  if (!result) {
    return (
      <MenuLayout labelledBy="result-title">
        <h1 id="result-title" ref={headingRef} tabIndex={-1} className="panel__heading">
          No battle yet
        </h1>
        <WoodButton onClick={goToMenu}>Main menu</WoodButton>
      </MenuLayout>
    );
  }

  const timeUp = result.endReason === 'time_up';
  return (
    <MenuLayout labelledBy="result-title">
      <h1 id="result-title" ref={headingRef} tabIndex={-1} className="panel__heading">
        {timeUp ? 'Battle complete' : 'Ship sunk'}
      </h1>
      <p className="result__score" aria-describedby="result-summary">
        {result.score}
      </p>
      <p id="result-summary" className="result__summary">
        <span>Points</span> ·{' '}
        <span aria-label="Time played">{formatClock(result.durationMs / 1000)}</span> ·{' '}
        <span>{timeUp ? 'Time up' : 'Defeated'}</span>
      </p>
      <RegistrationStatusLine matchId={result.matchId} confirmed={result.registered} />
      <div className="panel__actions">
        <WoodButton onClick={startMatch}>Play again</WoodButton>
        <WoodButton onClick={goToMenu}>Main menu</WoodButton>
      </div>
    </MenuLayout>
  );
}
