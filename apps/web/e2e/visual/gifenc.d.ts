// Minimal types for `gifenc` (it ships none): only what e2e/visual/gif.ts uses. It is a
// CommonJS package, so it is imported as a default export (Node cannot detect its named
// exports from an ES module).
declare module "gifenc" {
  type Palette = number[][];
  interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: Palette; delay?: number; repeat?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  // Plain functions (they never use `this`), hence function-typed properties.
  const gifenc: {
    GIFEncoder: () => Encoder;
    quantize: (
      rgba: Uint8Array | Uint8ClampedArray,
      maxColors: number,
      options?: { format?: "rgb565" | "rgb444" | "rgba4444" },
    ) => Palette;
    applyPalette: (
      rgba: Uint8Array | Uint8ClampedArray,
      palette: Palette,
      format?: "rgb565" | "rgb444" | "rgba4444",
    ) => Uint8Array;
  };
  export default gifenc;
}
