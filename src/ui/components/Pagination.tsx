import { RoundButton } from './buttons.tsx';

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onChange: (page: number) => void;
}

/** "PAGE 1 OF 3" with previous/next round buttons. */
export function Pagination({ page, totalPages, label, disabled, onChange }: PaginationProps) {
  const pages = Math.max(1, totalPages);
  return (
    <nav className="pagination" aria-label={label}>
      <RoundButton
        label="Previous page"
        icon="icon_turn_left"
        small
        disabled={disabled === true || page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
      />
      <span aria-live="polite">
        Page {Math.min(page, pages)} of {pages}
      </span>
      <RoundButton
        label="Next page"
        icon="icon_turn_right"
        small
        disabled={disabled === true || page >= pages}
        onClick={() => {
          onChange(page + 1);
        }}
      />
    </nav>
  );
}
