import { useCallback, useEffect, useRef, useState } from 'react';
import { useScreenStore, type MatchSession } from '../../app/screenStore.ts';
import type { MatchResult } from '../../game/core/types.ts';
import type { GameController } from '../../game/GameController.ts';
import { createHudStore } from '../../game/hudStore.ts';
import { GameCanvas } from '../game/GameCanvas.tsx';
import { Hud } from '../game/Hud.tsx';

/** Delay between the end of the match and the result screen (lets the explosion play). */
const RESULT_DELAY_MS = 1200;

export function GameScreen({ session }: { readonly session: MatchSession }) {
  const finishMatch = useScreenStore((state) => state.finishMatch);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const [hud] = useState(() => createHudStore());
  const controllerRef = useRef<GameController | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(resultTimer.current);
    },
    [],
  );

  const pause = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || controller.simulation.phase !== 'running') return;
    controller.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    controllerRef.current?.resume();
    setPaused(false);
  }, []);

  const onMatchEnded = useCallback(
    (result: MatchResult) => {
      resultTimer.current = window.setTimeout(() => {
        finishMatch(result);
      }, RESULT_DELAY_MS);
    },
    [finishMatch],
  );

  const onController = useCallback((controller: GameController | null) => {
    controllerRef.current = controller;
  }, []);

  const onError = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'The game could not start.');
  }, []);

  return (
    <div className="game-screen">
      <GameCanvas
        session={session}
        hud={hud}
        onMatchEnded={onMatchEnded}
        onPauseRequested={pause}
        onController={onController}
        onError={onError}
      />
      <Hud hud={hud} onPause={pause} />
      {paused && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <h2 id="pause-title">Paused</h2>
          <button type="button" className="button" onClick={resume} autoFocus>
            Resume
          </button>
          <button type="button" className="button button--secondary" onClick={goToMenu}>
            Main menu
          </button>
        </div>
      )}
      {error && (
        <div className="overlay" role="alert">
          <p>{error}</p>
          <button type="button" className="button" onClick={goToMenu}>
            Main menu
          </button>
        </div>
      )}
    </div>
  );
}
