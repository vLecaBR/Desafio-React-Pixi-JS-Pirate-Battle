import { useEffect, useState } from 'react';

const HINT_DURATION_MS = 4500;

/** Short reminder of the controls shown at the start of a match. Purely visual. */
export function MatchHint({ touch }: { readonly touch: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, HINT_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <p className="match-hint" aria-hidden="true">
      {touch
        ? 'Hold the left buttons to sail and turn, the right buttons to fire.'
        : 'W A D or arrows to sail · Space front cannon · Q / E broadsides · Esc pause'}
    </p>
  );
}
