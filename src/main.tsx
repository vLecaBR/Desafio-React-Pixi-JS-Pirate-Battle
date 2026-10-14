import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { queryClient } from './data/queryClient.ts';
import { startBackgroundSync } from './data/services.ts';
import { audio } from './game/audio/AudioManager.ts';
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
