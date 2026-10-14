import { useScreenStore, type LogTab } from '../../app/screenStore.ts';
import { WoodButton } from '../components/buttons.tsx';
import { MenuLayout } from '../components/MenuLayout.tsx';
import { Tabs } from '../components/Tabs.tsx';
import { useFocusOnMount } from '../hooks/useFocusOnMount.ts';
import { HistoryPanel, RankingPanel } from '../log/LogPanels.tsx';

const TABS = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
] as const satisfies readonly { id: LogTab; label: string }[];

/** "Captain's Log": Ranking and Match History tabs (as in the mockups). */
export function CaptainsLog() {
  const tab = useScreenStore((state) => state.logTab);
  const setLogTab = useScreenStore((state) => state.setLogTab);
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <MenuLayout wide labelledBy="log-title">
      <h1 id="log-title" ref={headingRef} tabIndex={-1} className="panel__heading">
        Captain&apos;s Log
      </h1>
      <Tabs
        label="Captain's Log sections"
        tabs={TABS}
        selected={tab}
        idPrefix="log"
        onSelect={setLogTab}
      />
      <div
        className="log__panel"
        role="tabpanel"
        id={`log-panel-${tab}`}
        aria-labelledby={`log-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'ranking' ? <RankingPanel /> : <HistoryPanel />}
      </div>
      <WoodButton onClick={goToMenu}>Main menu</WoodButton>
    </MenuLayout>
  );
}
