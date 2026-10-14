import { lazy, Suspense } from 'react';
import { CaptainsLog } from '../ui/screens/CaptainsLog.tsx';
import { LoadingScreen } from '../ui/screens/LoadingScreen.tsx';
import { MainMenu } from '../ui/screens/MainMenu.tsx';
import { OptionsScreen } from '../ui/screens/OptionsScreen.tsx';
import { ResultScreen } from '../ui/screens/ResultScreen.tsx';
import { useScreenStore } from './screenStore.ts';

// PixiJS and the game only load when a match starts (prefetched by LoadingScreen).
const GameScreen = lazy(() =>
  import('../ui/screens/GameScreen.tsx').then((module) => ({ default: module.GameScreen })),
);

export function App() {
  const screen = useScreenStore((state) => state.screen);
  const session = useScreenStore((state) => state.session);

  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'options':
      return <OptionsScreen />;
    case 'log':
      return <CaptainsLog />;
    case 'loading':
      return <LoadingScreen />;
    case 'playing':
      return session ? (
        <Suspense fallback={null}>
          <GameScreen key={session.key} session={session} />
        </Suspense>
      ) : (
        <MainMenu />
      );
    case 'result':
      return <ResultScreen />;
  }
}
