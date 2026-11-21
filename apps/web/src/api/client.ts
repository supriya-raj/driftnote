import type { Role } from "@driftnote/shared";

/** Browser side of the REST API (ARCHITECTURE.md, section 6.2), same origin. */

export interface LinkInfo {
  tokenId: number;
  role: "edit" | "view";
  createdAt: number;
  revokedAt: number | null;
}

/** An API answer other than success; `status` 0 means the server could not be reached. */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API request failed (${String(status)})`);
  }
}

async function call(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
    });
  } catch {
    throw new ApiError(0); // offline or server unreachable
  }
  if (!res.ok) throw new ApiError(res.status);
  return res;
}

export async function fetchRole(noteId: string, token: string): Promise<Role> {
  const res = await call(`/notes/${noteId}/role`, token);
  return ((await res.json()) as { role: Role }).role;
}

export async function listLinks(noteId: string, ownerToken: string): Promise<LinkInfo[]> {
  return (await (await call(`/notes/${noteId}/tokens`, ownerToken)).json()) as LinkInfo[];
}

export async function createLink(
  noteId: string,
  ownerToken: string,
  role: "edit" | "view",
): Promise<LinkInfo & { token: string }> {
  const res = await call(`/notes/${noteId}/tokens`, ownerToken, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
  return (await res.json()) as LinkInfo & { token: string };
}

export async function revokeLink(
  noteId: string,
  ownerToken: string,
  tokenId: number,
): Promise<void> {
  await call(`/notes/${noteId}/tokens/${String(tokenId)}`, ownerToken, { method: "DELETE" });
}

/** The link someone opens: the token travels in the fragment, which browsers never send. */
export function shareUrl(noteId: string, token: string): string {
  return `${location.origin}/n/${noteId}#t=${token}`;
}
