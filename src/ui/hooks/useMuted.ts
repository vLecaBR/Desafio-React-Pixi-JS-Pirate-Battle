import { useSyncExternalStore } from 'react';
import { audio } from '../../game/audio/AudioManager.ts';

export function useMuted(): boolean {
  return useSyncExternalStore(
    (listener) => audio.subscribe(listener),
    () => audio.muted,
    () => true,
  );
}
