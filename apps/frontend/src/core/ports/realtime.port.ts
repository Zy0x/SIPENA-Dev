export interface RealtimePort {
  subscribe(channel: string, callback: (payload: unknown) => void): void;
  unsubscribe(channel: string): void;
}
