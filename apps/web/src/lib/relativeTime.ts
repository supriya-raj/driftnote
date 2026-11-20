const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const sameYear = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const otherYear = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Just now", "5 minutes ago", "Yesterday", "Mar 4", "Mar 4, 2025". */
export function formatEdited(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 2 * DAY) return capitalise(relative.format(-1, "day"));
  const date = new Date(timestamp);
  return date.getFullYear() === new Date(now).getFullYear()
    ? sameYear.format(date)
    : otherYear.format(date);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
