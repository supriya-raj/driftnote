import { Icon } from "../components/Icon";
import "./EmptyState.css";

/** Shown in the content pane when no note is open (wide screens only). */
export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name="note" size={28} />
      </div>
      <h2 className="empty-state-title">No note selected</h2>
      <p className="empty-state-text">
        Pick a note from the list, or start a new one. Everything is saved in this browser as you
        type, and keeps working offline.
      </p>
    </div>
  );
}
