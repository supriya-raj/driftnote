import { useEffect, useState } from "react";
import { ensurePersistentStorage } from "./persistentStorage";

/** Warns when the browser keeps the right to delete local notes. */
export function StorageWarning() {
  const [persistent, setPersistent] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensurePersistentStorage()
      .catch(() => false)
      .then((granted) => {
        if (!cancelled) setPersistent(granted);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (persistent !== false) return null;
  return (
    <div role="alert" className="storage-warning">
      This browser has not granted persistent storage, so your notes may be deleted if the device
      runs low on space. Sharing a note backs it up to the server.
    </div>
  );
}
