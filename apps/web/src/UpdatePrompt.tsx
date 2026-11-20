import { useRegisterSW } from "virtual:pwa-register/react";

/** Registers the service worker and offers a reload when a new version is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div role="status" className="update-prompt">
      A new version of Driftnote is available.{" "}
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Reload
      </button>{" "}
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false);
        }}
      >
        Later
      </button>
    </div>
  );
}
