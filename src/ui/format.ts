/** Formats seconds as mm:ss. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "08 SEP" and "19:36" parts of an ISO date, in the player's time zone. */
export function formatPlayedAt(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '--', time: '--:--' };
  return { day: DAY.format(date).toUpperCase(), time: TIME.format(date) };
}

/** Two-digit rank as in the mockup ("01"). */
export function formatRank(rank: number): string {
  return String(rank).padStart(2, '0');
}
