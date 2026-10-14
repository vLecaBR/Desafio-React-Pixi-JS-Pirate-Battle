import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimum time between two announcements, so screen readers are never flooded. */
const MIN_INTERVAL_MS = 1200;

/**
 * Queue of discrete announcements (never per-frame values) released at a calm
 * pace into a polite live region. The region is cleared between messages so a
 * repeated message is announced again.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState('');
  const queue = useRef<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const lastAt = useRef(-Infinity);

  const release = useCallback(function releaseNext() {
    const next = queue.current.shift();
    if (next === undefined) {
      timer.current = undefined;
      return;
    }
    lastAt.current = performance.now();
    setMessage(next);
    timer.current = window.setTimeout(releaseNext, MIN_INTERVAL_MS);
  }, []);

  const announce = useCallback(
    (text: string) => {
      queue.current.push(text);
      if (timer.current !== undefined) return;
      setMessage('');
      const wait = Math.max(50, MIN_INTERVAL_MS - (performance.now() - lastAt.current));
      timer.current = window.setTimeout(release, wait);
    },
    [release],
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  return { message, announce };
}
