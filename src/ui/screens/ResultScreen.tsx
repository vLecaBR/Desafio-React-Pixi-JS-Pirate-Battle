import { useScreenStore } from '../../app/screenStore.ts';
import { formatClock } from '../format.ts';

/** Temporary result screen (registration status arrives with the data phase). */
export function ResultScreen() {
  const result = useScreenStore((state) => state.lastResult);
  const startMatch = useScreenStore((state) => state.startMatch);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  if (!result) return null;
  const reason = result.endReason === 'time_up' ? 'Time up' : 'Defeated';
  return (
    <main className="screen">
      <h1>{result.endReason === 'time_up' ? 'Battle complete' : 'Ship sunk'}</h1>
      <p className="result__score">{result.score}</p>
      <p>
        Points · {formatClock(result.durationMs / 1000)} · {reason}
      </p>
      <button
        type="button"
        className="button"
        onClick={() => {
          startMatch();
        }}
      >
        Play again
      </button>
      <button type="button" className="button button--secondary" onClick={goToMenu}>
        Main menu
      </button>
    </main>
  );
}
