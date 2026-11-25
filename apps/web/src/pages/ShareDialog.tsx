import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ApiError,
  createLink,
  listLinks,
  revokeLink,
  shareUrl,
  type LinkInfo,
} from "../api/client";
import { announce, LiveRegion } from "../a11y/announce";
import { Icon } from "../components/Icon";
import { formatEdited } from "../lib/relativeTime";
import { saveShareLink, shareLinksOf, type NoteAccess, type ShareLink } from "../notes/access";
import type { NoteSync } from "../sync/noteSync";
import "./ShareDialog.css";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string };

/** Owner's share dialog: create, copy and revoke edit/view links (ADR 006). */
export function ShareDialog({
  noteId,
  access,
  sync,
  onClose,
}: {
  noteId: string;
  access: NoteAccess;
  sync: NoteSync;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const syncState = useSyncExternalStore(sync.subscribe, () => sync.syncState);
  // The server knows the note once this browser has connected (the first connection
  // claims it), so links can be created while syncing or synced.
  const online = syncState === "syncing" || syncState === "synced";
  const [links, setLinks] = useState<LinkInfo[] | null>(null);
  const [tokens, setTokens] = useState<Map<number, ShareLink>>(new Map());
  const [created, setCreated] = useState<{ role: "edit" | "view"; url: string } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const linksHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // Bumped to reload the list after creating or revoking a link.
  const [version, setVersion] = useState(0);
  const refresh = (): void => setVersion((v) => v + 1);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void Promise.all([
      shareLinksOf(noteId),
      listLinks(noteId, access.token).catch((err: unknown) => new LoadError(err)),
    ]).then(([stored, listed]) => {
      if (cancelled) return;
      setTokens(stored);
      if (listed instanceof LoadError)
        setStatus({ kind: "error", message: describe(listed.cause) });
      else setLinks(listed);
    });
    return () => {
      cancelled = true;
    };
  }, [online, noteId, access.token, version]);

  async function onCreate(role: "edit" | "view"): Promise<void> {
    setStatus({ kind: "busy" });
    try {
      const link = await createLink(noteId, access.token, role);
      await saveShareLink({ ...link, noteId });
      setCreated({ role, url: shareUrl(noteId, link.token) });
      setStatus({ kind: "idle" });
      announce(
        `${role === "edit" ? "Edit" : "View"} link created and selected. Copy it to share the note.`,
      );
      refresh();
    } catch (err) {
      setStatus({ kind: "error", message: describe(err) });
    }
  }

  async function onRevoke(tokenId: number): Promise<void> {
    setStatus({ kind: "busy" });
    try {
      await revokeLink(noteId, access.token, tokenId);
      setStatus({ kind: "idle" });
      announce("Link revoked. It no longer opens this note.");
      refresh();
      // The row's buttons are gone; keep focus in the list instead of losing it.
      linksHeading.current?.focus();
    } catch (err) {
      setStatus({ kind: "error", message: describe(err) });
    }
  }

  const busy = status.kind === "busy";
  return (
    <dialog
      ref={dialog}
      className="share-dialog"
      // Not a tab stop itself (WebKit makes a scrollable dialog one): its controls are.
      tabIndex={-1}
      aria-labelledby="share-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current.close(); // click on the backdrop
      }}
    >
      <header className="share-header">
        <h2 id="share-title">Share this note</h2>
        <button
          type="button"
          className="btn btn-ghost share-close"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="plus" />
        </button>
      </header>

      <p className="share-intro">
        Anyone with a link can open this note. <strong>Edit</strong> links can change it;{" "}
        <strong>view</strong> links can only read it.
      </p>

      {!online && (
        <p className="share-hint" role="status">
          <Icon name="cloudOff" size={14} />
          Sharing needs a connection to the server. Links can be created once this note is online.
        </p>
      )}

      <div className="share-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!online || busy}
          onClick={() => void onCreate("edit")}
        >
          Create edit link
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!online || busy}
          onClick={() => void onCreate("view")}
        >
          Create view link
        </button>
      </div>

      {created && (
        <div className="share-created">
          <p className="share-created-title">
            New {created.role} link: copy it and send it to someone
          </p>
          <LinkField
            label={created.role === "edit" ? "Edit link" : "View link"}
            url={created.url}
            autoSelect
          />
        </div>
      )}

      {status.kind === "error" && (
        <p className="share-error" role="alert">
          {status.message}
        </p>
      )}

      {links && links.length > 0 && (
        <section className="share-links">
          <h3 ref={linksHeading} tabIndex={-1}>
            Links
          </h3>
          <ul aria-label="Links">
            {links.map((link) => (
              <LinkRow
                key={link.tokenId}
                link={link}
                stored={tokens.get(link.tokenId)}
                noteId={noteId}
                busy={busy}
                onRevoke={() => void onRevoke(link.tokenId)}
              />
            ))}
          </ul>
        </section>
      )}

      <LiveRegion scope="dialog" />

      <p className="share-footnote">
        Shared notes are stored on the Driftnote server, and its operator can read them.
      </p>
    </dialog>
  );
}

function LinkRow({
  link,
  stored,
  noteId,
  busy,
  onRevoke,
}: {
  link: LinkInfo;
  stored: ShareLink | undefined;
  noteId: string;
  busy: boolean;
  onRevoke: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // Focus follows the step: "Cancel" (the safe choice) when asked to confirm, "Revoke"
  // again when cancelled, so it is never left on a button that just disappeared.
  const [focusTarget, setFocusTarget] = useState<"cancel" | "revoke" | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const revokeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusTarget === "cancel") cancelButton.current?.focus();
    if (focusTarget === "revoke") revokeButton.current?.focus();
  }, [focusTarget]);
  const revoked = link.revokedAt !== null;
  return (
    <li className="share-link" data-revoked={revoked || undefined}>
      <div className="share-link-head">
        <span className="share-role" data-role={link.role}>
          {link.role === "edit" ? "Can edit" : "Can view"}
        </span>
        <span className="share-link-date">
          {revoked ? "Revoked" : `Created ${formatEdited(link.createdAt).toLowerCase()}`}
        </span>
        {!revoked &&
          (confirming ? (
            <span className="share-confirm">
              <button
                ref={cancelButton}
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setConfirming(false);
                  setFocusTarget("revoke");
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={onRevoke}>
                Confirm revoke
              </button>
            </span>
          ) : (
            <button
              ref={revokeButton}
              type="button"
              className="btn btn-ghost-danger"
              onClick={() => {
                setConfirming(true);
                setFocusTarget("cancel");
              }}
            >
              Revoke
            </button>
          ))}
      </div>
      {!revoked && stored && (
        <LinkField
          label={`Link ${String(link.tokenId)} (can ${link.role})`}
          url={shareUrl(noteId, stored.token)}
          compact
        />
      )}
    </li>
  );
}

function LinkField({
  label,
  url,
  autoSelect = false,
  compact = false,
}: {
  label: string;
  url: string;
  autoSelect?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoSelect) input.current?.select();
  }, [autoSelect, url]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      announce("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select(); // clipboard blocked: leave it selected for Ctrl/Cmd+C
      announce(`Link selected. Press ${COPY_SHORTCUT} to copy it.`);
    }
  }

  return (
    <div className="link-field" data-compact={compact || undefined}>
      <input
        ref={input}
        aria-label={label}
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        <Icon name={copied ? "check" : "copy"} size={14} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const COPY_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd+C" : "Ctrl+C";

class LoadError {
  constructor(readonly cause: unknown) {}
}

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return "Could not reach the server. Check your connection and try again.";
    if (err.status === 404)
      return "This note has not reached the server yet. Try again in a moment.";
  }
  return "Something went wrong. Please try again.";
}
