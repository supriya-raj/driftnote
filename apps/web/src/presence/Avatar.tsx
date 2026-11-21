import { initials } from "./identity";

/** A coloured circle with initials. Decorative: pair it with the name as text. */
export function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}
