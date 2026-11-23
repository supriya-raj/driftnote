import type { CDPSession, Page } from "@playwright/test";

/** One captured frame: when it was painted (ms) and the PNG image. */
export interface Frame {
  readonly at: number;
  readonly png: Buffer;
}

/**
 * Records a page as a sequence of frames using Chromium's screencast (DevTools protocol).
 * The browser sends a frame whenever the page repaints, with a timestamp, so the GIF can
 * keep real timing. Chromium only.
 */
export class Recorder {
  private readonly frames: Frame[] = [];
  private cdp: CDPSession | null = null;

  constructor(
    private readonly page: Page,
    private readonly maxWidth: number,
  ) {}

  async start(): Promise<void> {
    const cdp = await this.page.context().newCDPSession(this.page);
    this.cdp = cdp;
    cdp.on("Page.screencastFrame", (frame) => {
      this.frames.push({
        at: (frame.metadata.timestamp ?? Date.now() / 1000) * 1000,
        png: Buffer.from(frame.data, "base64"),
      });
      void cdp
        .send("Page.screencastFrameAck", { sessionId: frame.sessionId })
        .catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", {
      format: "png",
      maxWidth: this.maxWidth,
      maxHeight: 2000,
      everyNthFrame: 1,
    });
  }

  async stop(): Promise<Frame[]> {
    await this.cdp?.send("Page.stopScreencast").catch(() => undefined);
    return this.frames;
  }
}
