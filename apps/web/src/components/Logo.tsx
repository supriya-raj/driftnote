/** Driftnote's mark: three lines of a note, drifting like water. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <g fill="none" stroke="var(--on-accent)" strokeWidth="2.25" strokeLinecap="round">
        <path d="M8 11.5c2.6-1.9 5.4-1.9 8 0s5.4 1.9 8 0" />
        <path d="M8 16.5c2.6-1.9 5.4-1.9 8 0s5.4 1.9 8 0" opacity="0.8" />
        <path d="M8 21.5c2.6-1.9 5.4-1.9 8 0" opacity="0.6" />
      </g>
    </svg>
  );
}
