import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Creates a temp directory with the given files; returns its path and a cleanup. */
export async function makeTempDir(
  files: Record<string, string> = {},
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = await mkdtemp(join(tmpdir(), "driftnote-test-"));
  for (const [name, content] of Object.entries(files)) {
    const file = join(path, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) };
}
