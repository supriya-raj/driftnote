/**
 * Small inline SVG icons (stroke style, 1.75px, 16px grid), so there is no icon-font or
 * library dependency. Decorative by default: pair them with visible text.
 */
const PATHS = {
  plus: "M8 3.5v9M3.5 8h9",
  trash:
    "M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25M4.25 4.25l.6 8.4a1 1 0 0 0 1 .93h4.3a1 1 0 0 0 1-.93l.6-8.4",
  arrowLeft: "M9.75 3.75 5.5 8l4.25 4.25",
  check: "M3.5 8.25 6.5 11.25 12.5 5",
  alert:
    "M8 5.75v3M8 11v.01M6.86 2.6 1.9 11.2a1.3 1.3 0 0 0 1.13 1.95h9.94a1.3 1.3 0 0 0 1.13-1.95L9.14 2.6a1.3 1.3 0 0 0-2.28 0Z",
  info: "M8 7.25v3.5M8 5.25v.01M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z",
  note: "M4.5 2.25h5L12 4.75v8a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V3.25a1 1 0 0 1 1-1ZM9.25 2.25V5h2.75M5.75 8.25h4.5M5.75 10.75h3",
  lock: "M4.75 7V5.25a3.25 3.25 0 0 1 6.5 0V7M3.75 7h8.5a.5.5 0 0 1 .5.5v5.25a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5V7.5a.5.5 0 0 1 .5-.5Z",
  refresh: "M13 3.5v3h-3M3 12.5v-3h3M12.4 6.5A4.75 4.75 0 0 0 3.6 6M3.6 9.5a4.75 4.75 0 0 0 8.8.5",
  search: "M7.25 12.25a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM13.75 13.75 10.8 10.8",
  copy: "M5.75 5.75V3.25a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2.5M3.25 5.75h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z",
  share:
    "M8 2.5v7.25M5 5.25 8 2.25l3 3M3.5 8.5v4.25a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75V8.5",
  cloud: "M4.5 12.5h7a2.75 2.75 0 0 0 .4-5.47A4 4 0 0 0 4.2 7.6 2.5 2.5 0 0 0 4.5 12.5Z",
  cloudOff:
    "M2.5 2.5 13.5 13.5M6.3 4.1A4 4 0 0 1 11.9 7a2.75 2.75 0 0 1 1.5 4.7M11 12.5H4.5a2.5 2.5 0 0 1-.6-4.93",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
