import { useSyncExternalStore } from "react";

const query = window.matchMedia("(prefers-color-scheme: dark)");

/** The operating system's light/dark preference, kept live. */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => (query.matches ? "dark" : "light"),
  );
}
