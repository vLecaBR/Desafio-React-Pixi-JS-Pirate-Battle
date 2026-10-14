import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  readonly open: boolean;
  /** Id of the element that names the dialog. */
  readonly labelledBy: string;
  readonly describedBy?: string;
  /** Called when the user presses Escape (the dialog itself stays controlled). */
  readonly onCancel?: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Modal dialog built on the native `<dialog>` element: `showModal()` makes the
 * rest of the page inert and traps focus natively. Focus returns to the element
 * that was focused before opening.
 */
export function Dialog({
  open,
  labelledBy,
  describedBy,
  onCancel,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCancelRef.current?.();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore auto-repeat so holding Escape cannot close and reopen in a loop.
      if (event.key === 'Escape' && event.repeat) event.preventDefault();
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('keydown', handleKeyDown);
      if (dialog.open) dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className={className ? `dialog ${className}` : 'dialog'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {children}
    </dialog>
  );
}
