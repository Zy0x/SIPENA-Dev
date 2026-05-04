import type { AuthSessionEntity } from "@/core/entities/session.entity";
import type { UserEntity } from "@/core/entities/user.entity";

export function mapSupabaseUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): UserEntity | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
  };
}

export function mapSupabaseSession(session: {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: number | null;
  user: Parameters<typeof mapSupabaseUser>[0];
}): AuthSessionEntity {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: mapSupabaseUser(session.user)!,
  };
}
