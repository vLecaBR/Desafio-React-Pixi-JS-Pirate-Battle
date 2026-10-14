import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { HudState, HudStore } from '../../game/hudStore.ts';
import { RoundButton } from '../components/buttons.tsx';
import { LiveRegion } from '../components/LiveRegion.tsx';
import { useAnnouncer } from '../hooks/useAnnouncer.ts';
import { MuteButton } from '../components/MuteButton.tsx';
import { formatClock } from '../format.ts';

/** Fill area of the player health bar inside its frame (atlas `fill_rect`, 1x units). */
const FILL_RECT = { x: 30, w: 196, frame: 256 } as const;
const TIME_WARNING_SEC = 10;
const LOW_HEALTH_RATIO = 0.3;

/** `src` + `srcSet` for a HUD sprite (1x and retina). */
function hudImage(name: string) {
  return {
    src: `/assets/png/default/ui/hud/${name}.png`,
    srcSet: `/assets/png/default/ui/hud/${name}.png 1x, /assets/png/retina/ui/hud/${name}.png 2x`,
  };
}

function healthColour(ratio: number): 'green' | 'amber' | 'red' {
  if (ratio > 0.6) return 'green';
  if (ratio > LOW_HEALTH_RATIO) return 'amber';
  return 'red';
}

interface HudProps {
  readonly hud: HudStore;
  readonly onPause: () => void;
}

/**
 * Match HUD rendered with the atlas sprites. It subscribes to the HUD store with
 * narrow selectors, so it only re-renders when a displayed value changes (never
 * per frame). Score, time and match state are real text (semantic list), and only
 * discrete events are announced through a polite live region.
 */
export function Hud({ hud, onPause }: HudProps) {
  const hp = useStore(hud, (state) => state.hp);
  const maxHp = useStore(hud, (state) => state.maxHp);
  const score = useStore(hud, (state) => state.score);
  const remaining = useStore(hud, (state) => state.remainingSec);
  const phase = useStore(hud, (state) => state.phase);
  const { message, announce } = useAnnouncer();

  useMatchAnnouncements(hud, announce);

  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const colour = healthColour(ratio);
  // Clip the fill from the right so only `ratio` of the fill area remains visible.
  const hiddenRight =
    ((FILL_RECT.frame - FILL_RECT.x - FILL_RECT.w + FILL_RECT.w * (1 - ratio)) / FILL_RECT.frame) *
    100;
  const warning = phase === 'running' && remaining <= TIME_WARNING_SEC;
  const stateText = phase === 'paused' ? 'Paused' : phase === 'ended' ? 'Battle over' : 'In battle';

  return (
    <section className="hud" aria-label="Match status">
      <ul className="hud__group">
        <li className="hud__health">
          <img className="hud__icon" {...hudImage('icon_heart')} alt="" />
          <div className="health-bar">
            <img {...hudImage('health_frame')} alt="" />
            <img
              {...hudImage(`health_fill_${colour}`)}
              alt=""
              style={{ clipPath: `inset(0 ${hiddenRight}% 0 0)` }}
            />
            <span className="health-bar__text">
              <span className="visually-hidden">Health </span>
              {hp} / {maxHp}
            </span>
          </div>
        </li>
      </ul>
      <ul className="hud__group">
        <li className="counter">
          <img {...hudImage('icon_score')} alt="" />
          <span className="visually-hidden">Score </span>
          <span className="counter__value">{score}</span>
        </li>
        <li className={warning ? 'counter counter--warning' : 'counter'}>
          <img {...hudImage('icon_time')} alt="" />
          <span className="visually-hidden">Time left </span>
          <span className="counter__value">{formatClock(remaining)}</span>
        </li>
        <li className="visually-hidden">Status: {stateText}</li>
        <li>
          <MuteButton />
        </li>
        <li>
          <RoundButton
            label="Pause"
            icon="icon_pause"
            onClick={onPause}
            disabled={phase !== 'running'}
          />
        </li>
      </ul>
      <LiveRegion message={message} />
    </section>
  );
}

/** Announces discrete match events (never per-frame values). */
function useMatchAnnouncements(hud: HudStore, announce: (text: string) => void) {
  useEffect(() => {
    let previous: HudState = hud.getState();
    let lowHealthAnnounced = false;
    let timeWarningAnnounced = false;
    return hud.subscribe((state) => {
      const before = previous;
      previous = state;
      if (state.phase !== before.phase) {
        if (state.phase === 'running' && before.phase === 'starting') {
          announce(`Battle started. ${formatClock(state.remainingSec)} on the clock.`);
        } else if (state.phase === 'paused') {
          announce('Battle paused.');
        } else if (state.phase === 'running' && before.phase === 'paused') {
          announce('Battle resumed.');
        } else if (state.phase === 'ended') {
          const reason = state.endReason === 'time_up' ? 'Time is up' : 'Your ship was sunk';
          announce(`${reason}. Final score: ${state.score} points.`);
        }
      }
      if (
        !lowHealthAnnounced &&
        state.maxHp > 0 &&
        state.hp > 0 &&
        state.hp / state.maxHp <= LOW_HEALTH_RATIO
      ) {
        lowHealthAnnounced = true;
        announce(`Health low: ${state.hp} of ${state.maxHp}.`);
      }
      if (
        !timeWarningAnnounced &&
        state.phase === 'running' &&
        state.remainingSec <= TIME_WARNING_SEC
      ) {
        timeWarningAnnounced = true;
        announce(`${TIME_WARNING_SEC} seconds left.`);
      }
    });
  }, [hud, announce]);
}
