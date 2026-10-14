import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { queryClient } from './data/queryClient.ts';
import { startBackgroundSync } from './data/services.ts';
import { audio } from './game/audio/AudioManager.ts';
import { exposeLabActions, isTestMode } from './game/testing/testHooks.ts';
import { startMocks } from './mocks/start.ts';
import './ui/styles/global.css';

// Query devtools only in development builds (tree-shaken from production).
const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

audio.installUnlock();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// MSW must be running before the first render, or the first query could escape it.
const mocks = await startMocks();
if (isTestMode && mocks === 'running') {
  const { labActions } = await import('./mocks/lab.ts');
  exposeLabActions(labActions);
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {QueryDevtools && (
        <Suspense fallback={null}>
          <QueryDevtools buttonPosition="bottom-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>,
);

startBackgroundSync();
