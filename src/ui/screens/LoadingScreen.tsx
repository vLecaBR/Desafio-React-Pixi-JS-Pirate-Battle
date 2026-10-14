import { useCallback, useEffect, useState } from 'react';
import { useScreenStore } from '../../app/screenStore.ts';

/** Game code (PixiJS included) is code-split: it is fetched here, with the assets. */
async function loadGame(onProgress: (progress: number) => void): Promise<void> {
  const [{ loadGameAssets }] = await Promise.all([
    import('../../game/render/textures.ts'),
    import('./GameScreen.tsx'),
  ]);
  await loadGameAssets(onProgress);
}

type LoadState =
  | { readonly status: 'loading'; readonly progress: number }
  | { readonly status: 'error'; readonly message: string };

/**
 * Loads every match asset with visible progress. Combat only starts once all
 * textures are ready; failures show an accessible error with a retry action.
 */
export function LoadingScreen() {
  const assetsReady = useScreenStore((state) => state.assetsReady);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const [state, setState] = useState<LoadState>({ status: 'loading', progress: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGame((progress) => {
      if (!cancelled) setState({ status: 'loading', progress });
    })
      .then(() => {
        if (!cancelled) assetsReady();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'The game assets could not be loaded.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, assetsReady]);

  const retry = useCallback(() => {
    setState({ status: 'loading', progress: 0 });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'error') {
    return (
      <main className="screen">
        <h1>Loading failed</h1>
        <p role="alert">{state.message}</p>
        <button type="button" className="button" onClick={retry}>
          Try again
        </button>
        <button type="button" className="button button--secondary" onClick={goToMenu}>
          Main menu
        </button>
      </main>
    );
  }

  const percent = Math.round(state.progress * 100);
  return (
    <main className="screen" aria-busy="true">
      <h1>Preparing the fleet</h1>
      <label className="loading">
        <span>Loading assets: {percent}%</span>
        <progress max={100} value={percent} />
      </label>
    </main>
  );
}
