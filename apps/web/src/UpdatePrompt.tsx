import { useSyncExternalStore } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Icon } from "./components/Icon";
import "./UpdatePrompt.css";

/** Registers the service worker and offers a reload when a new version is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const previewed = useSyncExternalStore(subscribePreview, () => preview);

  if (!needRefresh && !previewed) return null;
  return (
    <div role="status" className="toast">
      <Icon name="refresh" />
      <p className="toast-text">A new version of Driftnote is available.</p>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setNeedRefresh(false);
          setPreview(false);
        }}
      >
        Later
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
    </div>
  );
}

// The prompt only appears when a new service worker is waiting, which tests cannot easily
// arrange; the `showUpdatePrompt` test hook shows it on demand (test builds only).
let preview = false;
const previewListeners = new Set<() => void>();

function subscribePreview(listener: () => void): () => void {
  previewListeners.add(listener);
  return () => previewListeners.delete(listener);
}

function setPreview(value: boolean): void {
  preview = value;
  for (const listener of previewListeners) listener();
}

/** Shows the prompt as if a new version were waiting (used by the test hook). */
export function previewUpdatePrompt(): void {
  setPreview(true);
}
