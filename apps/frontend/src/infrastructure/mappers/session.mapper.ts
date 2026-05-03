import type { AuthSessionEntity } from "@/core/entities/session.entity";

export function mapSessionRecord(record: Partial<AuthSessionEntity>): AuthSessionEntity {
  return {
    accessToken: record.accessToken ?? "",
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    user: record.user ?? { id: "", email: "" },
  };
}
