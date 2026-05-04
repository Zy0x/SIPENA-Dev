import type { RealtimePort } from "@/core/ports/realtime.port";
import { supabaseExternal } from "./supabase-client";

export class SupabaseRealtimeAdapter implements RealtimePort {
  private channels = new Map<string, ReturnType<typeof supabaseExternal.channel>>();

  subscribe(channel: string, callback: (payload: unknown) => void) {
    const subscription = supabaseExternal
      .channel(channel)
      .on("broadcast", { event: "*" }, (payload) => callback(payload))
      .subscribe();
    this.channels.set(channel, subscription);
  }

  unsubscribe(channel: string) {
    const subscription = this.channels.get(channel);
    if (subscription) void supabaseExternal.removeChannel(subscription);
    this.channels.delete(channel);
  }
}
