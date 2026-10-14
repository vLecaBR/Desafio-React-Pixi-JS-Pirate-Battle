import { useScreenStore } from '../../app/screenStore.ts';
import { MenuLayout } from '../components/MenuLayout.tsx';
import { OptionsForm } from '../components/OptionsForm.tsx';
import { useFocusOnMount } from '../hooks/useFocusOnMount.ts';

export function OptionsScreen() {
  const goToMenu = useScreenStore((state) => state.goToMenu);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <MenuLayout labelledBy="options-title">
      <h1 id="options-title" ref={headingRef} tabIndex={-1} className="panel__heading">
        Options
      </h1>
      <OptionsForm
        backLabel="Main menu"
        onBack={goToMenu}
        note="Changes apply to the next battle."
      />
    </MenuLayout>
  );
}
