export type MockStatus = 'disabled' | 'running' | 'failed';

let status: MockStatus = 'disabled';

export function mockStatus(): MockStatus {
  return status;
}

export function mocksEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_MOCKS !== 'false';
}

/**
 * Starts the MSW service worker before the first render, so the very first query
 * is already intercepted. Enabled in every build (including production) unless
 * `VITE_ENABLE_MOCKS=false`. If the worker cannot start, the app still boots: the
 * game works and the Captain's Log shows its error state.
 */
export async function startMocks(): Promise<MockStatus> {
  if (!mocksEnabled()) return (status = 'disabled');
  try {
    const { worker } = await import('./browser.ts');
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
    status = 'running';
  } catch {
    status = 'failed';
  }
  return status;
}
