import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query (e.g. coarse pointer, portrait orientation). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones and tablets: show touch controls and enforce landscape. */
export const COARSE_POINTER_QUERY = '(any-pointer: coarse)';
export const PORTRAIT_TOUCH_QUERY = '(orientation: portrait) and (pointer: coarse)';
