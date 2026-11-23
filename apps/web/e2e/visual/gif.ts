import gifenc from "gifenc";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PNG } from "pngjs";
import type { Frame } from "./recorder";

const { applyPalette, GIFEncoder, quantize } = gifenc;

interface Decoded {
  width: number;
  height: number;
  data: Buffer;
}

const GAP = 16; // px between side-by-side windows
const BACKGROUND = [0xe8, 0xe4, 0xdd] as const; // matches --surface-active (light)

/**
 * Writes an animated GIF from one or more recorded windows, placed side by side and kept
 * in step by their timestamps. Frames are sampled `fps` times a second; identical
 * consecutive images are merged into one longer frame to keep the file small.
 */
export function writeGif(
  path: string,
  tracks: readonly (readonly Frame[])[],
  options: {
    fps?: number;
    holdEndMs?: number;
    startAt?: number;
    /** Also save this many evenly spaced frames as PNGs here, for reviewing the GIF. */
    preview?: { dir: string; count: number };
  } = {},
): { bytes: number; frames: number } {
  const fps = options.fps ?? 10;
  const decoded = tracks.map((frames) => frames.map((f) => decode(f.png)));
  const sizes = decoded.map((frames) => frames.at(-1) ?? frames[0]);
  if (sizes.some((s) => s === undefined)) throw new Error("A track recorded no frames");
  const height = Math.max(...sizes.map((s) => s?.height ?? 0)) + 2 * GAP;
  const width = sizes.reduce((sum, s) => sum + (s?.width ?? 0), 0) + (tracks.length + 1) * GAP;

  const start = options.startAt ?? Math.min(...tracks.map((t) => t[0]?.at ?? Infinity));
  const end = Math.max(...tracks.map((t) => t.at(-1)?.at ?? 0)) + (options.holdEndMs ?? 1500);
  const step = 1000 / fps;

  const encoder = GIFEncoder();
  const previews: Uint8Array[] = [];
  let previousKey = "";
  let pending: { rgba: Uint8Array; delay: number } | null = null;
  let written = 0;
  const flush = (): void => {
    if (!pending) return;
    const palette = quantize(pending.rgba, 256, { format: "rgb565" });
    const index = applyPalette(pending.rgba, palette, "rgb565");
    encoder.writeFrame(index, width, height, { palette, delay: Math.round(pending.delay) });
    previews.push(pending.rgba);
    written += 1;
    pending = null;
  };

  for (let t = start; t <= end; t += step) {
    // For each window, the latest frame painted at or before time t.
    const picks = tracks.map((frames) => {
      let i = 0;
      while (i + 1 < frames.length && (frames[i + 1]?.at ?? Infinity) <= t) i++;
      return i;
    });
    const key = picks.join(",");
    if (key === previousKey && pending) {
      pending.delay += step;
      continue;
    }
    flush();
    previousKey = key;
    pending = { rgba: compose(decoded, picks, width, height), delay: step };
  }
  flush();
  encoder.finish();
  const bytes = encoder.bytes();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  if (options.preview) {
    const { dir, count } = options.preview;
    mkdirSync(dir, { recursive: true });
    const base =
      path
        .split("/")
        .pop()
        ?.replace(/\.gif$/, "") ?? "gif";
    for (let i = 0; i < count; i++) {
      const rgba =
        previews[
          Math.min(
            previews.length - 1,
            Math.round((i * (previews.length - 1)) / Math.max(1, count - 1)),
          )
        ];
      if (!rgba) continue;
      const png = new PNG({ width, height });
      png.data = Buffer.from(rgba);
      writeFileSync(`${dir}/${base}-${String(i + 1)}.png`, PNG.sync.write(png));
    }
  }
  return { bytes: bytes.length, frames: written };
}

function decode(png: Buffer): Decoded {
  const image = PNG.sync.read(png);
  return { width: image.width, height: image.height, data: image.data };
}

/** Draws the chosen frame of each window onto one canvas, left to right. */
function compose(tracks: Decoded[][], picks: number[], width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = BACKGROUND[0];
    out[i + 1] = BACKGROUND[1];
    out[i + 2] = BACKGROUND[2];
    out[i + 3] = 255;
  }
  let x0 = GAP;
  tracks.forEach((frames, t) => {
    const image = frames[picks[t] ?? 0];
    if (!image) return;
    for (let y = 0; y < image.height; y++) {
      const from = y * image.width * 4;
      out.set(image.data.subarray(from, from + image.width * 4), ((y + GAP) * width + x0) * 4);
    }
    x0 += image.width + GAP;
  });
  return out;
}
