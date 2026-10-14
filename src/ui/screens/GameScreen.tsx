import { useCallback, useEffect, useRef, useState } from 'react';
import { useScreenStore, type MatchSession } from '../../app/screenStore.ts';
import type { MatchResult } from '../../game/core/types.ts';
import type { GameController } from '../../game/GameController.ts';
import { createHudStore } from '../../game/hudStore.ts';
import { GameCanvas } from '../game/GameCanvas.tsx';
import { Hud } from '../game/Hud.tsx';
import { MatchHint } from '../game/MatchHint.tsx';
import { PauseDialog, type PauseReason } from '../game/PauseDialog.tsx';
import { TouchControls } from '../game/TouchControls.tsx';
import {
  COARSE_POINTER_QUERY,
  PORTRAIT_TOUCH_QUERY,
  useMediaQuery,
} from '../hooks/useMediaQuery.ts';

/** Delay between the end of the match and the result screen (lets the explosion play). */
const RESULT_DELAY_MS = 1200;

/**
 * Combat screen: Pixi canvas, HUD, touch controls and the pause flow.
 * Pauses automatically when the tab is hidden, the window loses focus or a touch
 * device is rotated to portrait. Leaving this screen (menu or reload) abandons the
 * match; nothing is recorded for an abandoned match.
 */
export function GameScreen({ session }: { readonly session: MatchSession }) {
  const finishMatch = useScreenStore((state) => state.finishMatch);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const [hud] = useState(() => createHudStore());
  const [controller, setController] = useState<GameController | null>(null);
  const controllerRef = useRef<GameController | null>(null);
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultTimer = useRef<number | undefined>(undefined);
  const coarsePointer = useMediaQuery(COARSE_POINTER_QUERY);
  const portrait = useMediaQuery(PORTRAIT_TOUCH_QUERY);

  useEffect(
    () => () => {
      window.clearTimeout(resultTimer.current);
    },
    [],
  );

  const pause = useCallback((reason: PauseReason) => {
    const current = controllerRef.current;
    if (!current || current.simulation.phase !== 'running' || current.isPaused) return;
    current.pause();
    setPauseReason(reason);
  }, []);

  const resume = useCallback(() => {
    controllerRef.current?.resume();
    setPauseReason(null);
  }, []);

  const requestManualPause = useCallback(() => {
    pause('manual');
  }, [pause]);

  // Automatic pause: hidden tab or lost focus.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pause('hidden');
    };
    const onBlur = () => {
      pause('blur');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [pause]);

  // Landscape only on touch devices: portrait pauses and shows a rotate prompt.
  useEffect(() => {
    if (portrait) pause('portrait');
  }, [portrait, pause]);

  const onController = useCallback(
    (created: GameController | null) => {
      controllerRef.current = created;
      setController(created);
      if (created && (document.visibilityState === 'hidden' || portrait)) {
        pause(portrait ? 'portrait' : 'hidden');
      }
    },
    [pause, portrait],
  );

  const onMatchEnded = useCallback(
    (result: MatchResult) => {
      setEnded(true);
      setPauseReason(null);
      resultTimer.current = window.setTimeout(() => {
        finishMatch(result);
      }, RESULT_DELAY_MS);
    },
    [finishMatch],
  );

  const onError = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : 'The game could not start.');
  }, []);

  const paused = pauseReason !== null;

  return (
    <div className="game-screen">
      <GameCanvas
        session={session}
        hud={hud}
        onMatchEnded={onMatchEnded}
        onPauseRequested={requestManualPause}
        onController={onController}
        onError={onError}
      />
      <Hud hud={hud} onPause={requestManualPause} />
      {coarsePointer && (
        <TouchControls
          touch={controller?.touch ?? null}
          disabled={paused || ended || !controller}
        />
      )}
      {controller && !ended && <MatchHint touch={coarsePointer} />}
      <PauseDialog
        open={paused && !portrait}
        reason={pauseReason ?? 'manual'}
        onResume={resume}
        onMainMenu={goToMenu}
      />
      {portrait && (
        <div className="rotate-overlay" role="alert">
          <img src="/assets/png/default/ships/ship_5.png" alt="" className="rotate-overlay__icon" />
          <p>Rotate your device to landscape to keep playing.</p>
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
