import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
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
    <div role="alert" className="notice notice-warning">
      <Icon name="alert" />
      <div>
        <p className="notice-title">Storage isn’t guaranteed</p>
        <p>Notes may be deleted if this device runs low on space.</p>
      </div>
    </div>
  );
}
