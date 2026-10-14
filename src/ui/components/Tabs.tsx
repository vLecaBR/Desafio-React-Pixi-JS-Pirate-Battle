import { useRef, type KeyboardEvent } from 'react';
import { playUiSound } from '../../game/audio/uiSound.ts';

export interface TabSpec<T extends string> {
  readonly id: T;
  readonly label: string;
}

interface TabsProps<T extends string> {
  readonly label: string;
  readonly tabs: readonly TabSpec<T>[];
  readonly selected: T;
  readonly idPrefix: string;
  readonly onSelect: (id: T) => void;
}

/**
 * Accessible tab list (WAI-ARIA tabs pattern): roving tabindex, arrow keys,
 * Home/End. The active tab uses the primary wooden button, the others the
 * secondary one, as in the Captain's Log mockup.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  selected,
  idPrefix,
  onSelect,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const count = tabs.length;
    const next = ((index % count) + count) % count;
    const tab = tabs[next];
    if (!tab) return;
    onSelect(tab.id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const handlers: Partial<Record<string, () => void>> = {
      ArrowRight: () => {
        focusTab(index + 1);
      },
      ArrowLeft: () => {
        focusTab(index - 1);
      },
      Home: () => {
        focusTab(0);
      },
      End: () => {
        focusTab(tabs.length - 1);
      },
    };
    const handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={isSelected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={isSelected ? 0 : -1}
            className="wood-button"
            onClick={() => {
              if (!isSelected) playUiSound('ui_click');
              onSelect(tab.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
