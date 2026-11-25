import { useSyncExternalStore } from "react";

/**
 * How this person appears to collaborators (ADR 006: names are unverified). Stored in
 * localStorage, which is fine: nothing here is secret.
 */
export interface Identity {
  name: string;
  color: string;
}

/**
 * Cursor colours: each has at least 4.5:1 contrast with the white text of cursor labels
 * and avatars (WCAG AA).
 */
export const PRESENCE_COLORS = [
  "#3e63dd",
  "#0f6e7a",
  "#1f7a52",
  "#c2298a",
  "#8e4ec6",
  "#ca3214",
  "#ad5700",
  "#5b5bd6",
] as const;

/** Earlier palette colours that failed that contrast, and what replaced them. */
const RETIRED_COLORS: Record<string, string> = {
  "#30a46c": "#1f7a52",
  "#d6409f": "#c2298a",
  "#e54d2e": "#ca3214",
};

const KEY = "driftnote.identity";
const ADJECTIVES = ["Calm", "Bright", "Quiet", "Swift", "Gentle", "Bold", "Curious", "Sunny"];
const ANIMALS = ["Otter", "Heron", "Fox", "Lynx", "Robin", "Seal", "Wren", "Badger"];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function read(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.name === "string" && typeof parsed.color === "string") {
      return { name: parsed.name, color: RETIRED_COLORS[parsed.color] ?? parsed.color };
    }
  } catch {
    // Storage blocked or corrupt: fall back to a default for this page view.
  }
  return null;
}

let current: Identity = read() ?? {
  name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
  color: pick(PRESENCE_COLORS),
};
const listeners = new Set<() => void>();

export function getIdentity(): Identity {
  return current;
}

export function setIdentity(next: Identity): void {
  current = { name: next.name.trim().slice(0, 40) || current.name, color: next.color };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not persisted (private mode); still used for this page view.
  }
  for (const listener of listeners) listener();
}

// Keep the default stable across reloads from the first visit on.
if (!read()) setIdentity(current);

/** The current identity, re-rendering when it changes (here or in another tab). */
export function useIdentity(): Identity {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent): void => {
        if (e.key !== KEY) return;
        current = read() ?? current;
        onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => current,
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : [parts[0]];
  return letters
    .map((p) => p?.[0] ?? "")
    .join("")
    .toUpperCase();
}
