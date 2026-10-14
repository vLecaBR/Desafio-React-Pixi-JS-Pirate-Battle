import { audio, type SoundId } from './AudioManager.ts';

/** Plays a short interface sound (buttons, dialogs). Silent until audio is unlocked. */
export function playUiSound(id: Extract<SoundId, `ui_${string}`>): void {
  audio.play(id, { volume: 0.45 });
}
