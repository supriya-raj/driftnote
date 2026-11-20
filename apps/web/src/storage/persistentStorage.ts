/**
 * By default browsers may evict a site's IndexedDB under storage pressure ("best effort"
 * storage). Notes live only here until synced, so ask for persistent storage once at
 * startup (ADR 004). Returns whether storage is (now) persistent.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  // `storage` is missing in some contexts (e.g. old browsers, non-secure origins).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
