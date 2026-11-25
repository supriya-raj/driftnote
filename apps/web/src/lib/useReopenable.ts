import { useState } from "react";

/**
 * Open/closed state for a dialog that opens itself when it mounts (`showModal()` in an
 * effect). A `<dialog>` reports closing with a `close` event that arrives *later*, as a
 * separate task, and browsers handle key presses first. With a plain boolean, "Escape,
 * then a quick Enter on the opener" ran as: open (already open, no change), then the late
 * close: the button did nothing. Each opening therefore gets its own `key`, so a fresh
 * dialog mounts; React ignores the late close of the old, unmounted one.
 */
export function useReopenable(): {
  isOpen: boolean;
  key: number;
  open: () => void;
  close: () => void;
} {
  const [state, setState] = useState({ isOpen: false, key: 0 });
  return {
    ...state,
    open: () => setState((s) => ({ isOpen: true, key: s.key + 1 })),
    close: () => setState((s) => ({ ...s, isOpen: false })),
  };
}
