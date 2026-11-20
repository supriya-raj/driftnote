import { useRegisterSW } from "virtual:pwa-register/react";
import { Icon } from "./components/Icon";
import "./UpdatePrompt.css";

/** Registers the service worker and offers a reload when a new version is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div role="status" className="toast">
      <Icon name="refresh" />
      <p className="toast-text">A new version of Driftnote is available.</p>
      <button type="button" className="btn btn-ghost" onClick={() => setNeedRefresh(false)}>
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
