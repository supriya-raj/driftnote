/**
 * Opens a WebSocket and reports how the server treated it: `{ closed: code }` if the
 * server closed it, or `"accepted"` once the server started the sync (first message).
 */
export function connectionOutcome(url: string): Promise<{ closed: number } | "accepted"> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onmessage = () => {
      resolve("accepted");
      ws.close();
    };
    ws.onclose = (event) => resolve({ closed: event.code });
  });
}
