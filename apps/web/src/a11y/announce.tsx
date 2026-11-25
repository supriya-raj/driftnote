import { useEffect, useState } from "react";

/**
 * Announcements for screen readers: changes that happen without focus moving (the
 * connection drops, a link is copied). Spoken through a polite live region.
 *
 * A modal dialog hides everything outside it from assistive technology, so a region on
 * the page would go unheard while one is open. Each dialog therefore has its own region,
 * and `announce` speaks through the most recently mounted one (the open dialog's, or the
 * page's).
 */

interface Region {
  say(message: string): void;
}

const regions: Region[] = [];

export function announce(message: string): void {
  regions.at(-1)?.say(message);
}

export function LiveRegion({ scope }: { scope: "page" | "dialog" }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let frame = 0;
    const region: Region = {
      say(message) {
        // Clear first, then set on the next frame: repeating the same message ("Link
        // copied" twice) must still be a change for the screen reader to speak it.
        setText("");
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setText(message));
      },
    };
    regions.push(region);
    return () => {
      cancelAnimationFrame(frame);
      regions.splice(regions.indexOf(region), 1);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="visually-hidden" data-announcer={scope}>
      {text}
    </div>
  );
}
