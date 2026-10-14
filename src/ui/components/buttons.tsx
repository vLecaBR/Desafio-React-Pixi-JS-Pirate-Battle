import type { ButtonHTMLAttributes } from 'react';
import { playUiSound } from '../../game/audio/uiSound.ts';

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>;

interface WoodButtonProps extends NativeButtonProps {
  readonly variant?: 'primary' | 'secondary';
}

/** Wooden menu button (9-slice sprite from the UI atlas). */
export function WoodButton({ variant = 'primary', className, onClick, ...rest }: WoodButtonProps) {
  return (
    <button
      type="button"
      className={['wood-button', variant === 'secondary' ? 'wood-button--secondary' : '', className]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        playUiSound('ui_click');
        onClick?.(event);
      }}
      {...rest}
    />
  );
}

interface RoundButtonProps extends NativeButtonProps {
  /** Accessible name (the button only shows an icon). */
  readonly label: string;
  /** Icon file name in `ui/controls`, e.g. `icon_pause`. */
  readonly icon: string;
  readonly small?: boolean;
}

/** Round brass button with an icon. */
export function RoundButton({ label, icon, small, className, onClick, ...rest }: RoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={['round-button', small ? 'round-button--small' : '', className]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        playUiSound('ui_click');
        onClick?.(event);
      }}
      {...rest}
    >
      <img
        src={`/assets/png/default/ui/controls/${icon}.png`}
        srcSet={`/assets/png/default/ui/controls/${icon}.png 1x, /assets/png/retina/ui/controls/${icon}.png 2x`}
        alt=""
      />
    </button>
  );
}
