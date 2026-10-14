import type { ReactNode } from 'react';

interface MenuLayoutProps {
  readonly children: ReactNode;
  /** Wide panel (Captain's Log). */
  readonly wide?: boolean;
  /** Element id of the panel heading, used as the region label. */
  readonly labelledBy?: string;
  /** Extra controls pinned to the top-right corner (e.g. sound toggle). */
  readonly corner?: ReactNode;
}

/**
 * Shared frame of every menu screen: the game's scene in the background, the
 * wooden 9-slice panel and the Jungle Gaming logo.
 */
export function MenuLayout({ children, wide, labelledBy, corner }: MenuLayoutProps) {
  return (
    <main className="menu-screen">
      <section className={wide ? 'panel panel--wide' : 'panel'} aria-labelledby={labelledBy}>
        {children}
      </section>
      {corner && <div className="menu-corner">{corner}</div>}
      <img className="brand-logo" src="/assets/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </main>
  );
}
