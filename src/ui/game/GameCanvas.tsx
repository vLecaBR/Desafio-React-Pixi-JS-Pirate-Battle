import { useEffect, useRef } from 'react';
import type { MatchSession } from '../../app/screenStore.ts';
import type { MatchResult } from '../../game/core/types.ts';
import { GameController } from '../../game/GameController.ts';
import type { HudStore } from '../../game/hudStore.ts';
import { getLoadedTextures } from '../../game/render/textures.ts';
import { isTestMode, setTestController } from '../../game/testing/testHooks.ts';

interface GameCanvasProps {
  readonly session: MatchSession;
  readonly hud: HudStore;
  readonly onMatchEnded: (result: MatchResult) => void;
  readonly onPauseRequested: () => void;
  readonly onController: (controller: GameController | null) => void;
  readonly onError: (error: unknown) => void;
}

/**
 * Hosts the PixiJS canvas. Safe under React StrictMode: the controller is created
 * asynchronously, so a `disposed` flag destroys any instance that resolves after the
 * effect was cleaned up (StrictMode mounts, unmounts and mounts again in dev).
 * A new `session.key` (Play again) creates a brand-new controller.
 */
export function GameCanvas(props: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });

  const { session, hud } = props;

  useEffect(() => {
    const host = hostRef.current;
    const textures = getLoadedTextures();
    if (!host || !textures) return;

    let disposed = false;
    let controller: GameController | null = null;

    GameController.create(host, {
      config: session.config,
      seed: session.seed,
      textures,
      hud,
      manualClock: isTestMode,
      ...(session.setup ? { setup: session.setup } : {}),
      onMatchEnded: (result) => {
        callbacks.current.onMatchEnded(result);
      },
      onPauseRequested: () => {
        callbacks.current.onPauseRequested();
      },
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        controller = created;
        created.start();
        setTestController(created);
        callbacks.current.onController(created);
      })
      .catch((error: unknown) => {
        if (!disposed) callbacks.current.onError(error);
      });

    return () => {
      disposed = true;
      setTestController(null);
      callbacks.current.onController(null);
      controller?.destroy();
      controller = null;
    };
  }, [session, hud]);

  return <div ref={hostRef} className="game-canvas" />;
}
