/** Visually hidden polite live region (see `useAnnouncer`). */
export function LiveRegion({ message }: { readonly message: string }) {
  return (
    <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
