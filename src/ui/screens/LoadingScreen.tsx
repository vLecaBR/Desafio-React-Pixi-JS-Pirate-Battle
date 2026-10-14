import { useCallback, useEffect, useState } from 'react';
import { useScreenStore } from '../../app/screenStore.ts';
import { WoodButton } from '../components/buttons.tsx';
import { MenuLayout } from '../components/MenuLayout.tsx';

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
    let settled = false;
    loadGame((progress) => {
      // Late progress from files still loading must not hide an error.
      if (!cancelled && !settled) setState({ status: 'loading', progress });
    })
      .then(() => {
        settled = true;
        if (!cancelled) assetsReady();
      })
      .catch((error: unknown) => {
        settled = true;
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error && error.name === 'AssetLoadError'
              ? error.message
              : 'The game could not be loaded. Check your connection and try again.',
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
      <MenuLayout labelledBy="loading-title">
        <h1 id="loading-title" className="panel__heading">
          Loading failed
        </h1>
        <p className="field-error" role="alert">
          {state.message}
        </p>
        <div className="panel__actions">
          <WoodButton onClick={retry} autoFocus>
            Try again
          </WoodButton>
          <WoodButton variant="secondary" onClick={goToMenu}>
            Main menu
          </WoodButton>
        </div>
      </MenuLayout>
    );
  }

  const percent = Math.round(state.progress * 100);
  return (
    <MenuLayout labelledBy="loading-title">
      <h1 id="loading-title" className="panel__heading">
        Preparing the fleet
      </h1>
      <div className="loading-bar">
        <label htmlFor="loading-progress">Loading assets: {percent}%</label>
        <progress id="loading-progress" max={100} value={percent} aria-busy="true" />
      </div>
    </MenuLayout>
  );
}
