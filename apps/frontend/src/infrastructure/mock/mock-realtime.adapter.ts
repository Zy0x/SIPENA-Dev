import type { RealtimePort } from "@/core/ports/realtime.port";

export class MockRealtimeAdapter implements RealtimePort {
  subscribe(): void {}
  unsubscribe(): void {}
}
