import { useEffect, useRef } from 'react';

/**
 * Moves focus to the returned element when a screen mounts (usually its heading,
 * with tabIndex={-1}), so keyboard and screen-reader users land on the new screen.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
