import type { RealtimePort } from "@/core/ports/realtime.port";

export class HttpRealtimeAdapter implements RealtimePort {
  subscribe(): void {
    throw new Error("HttpRealtimeAdapter is not implemented. Use websocket/sse provider for realtime.");
  }

  unsubscribe(): void {
    // No-op placeholder until websocket/sse provider is implemented.
  }
}
