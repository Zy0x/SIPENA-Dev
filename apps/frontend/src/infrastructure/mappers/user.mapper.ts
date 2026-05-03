import type { UserEntity } from "@/core/entities/user.entity";

export function mapUserRecord(record: Partial<UserEntity>): UserEntity {
  return {
    id: record.id ?? "",
    email: record.email ?? "",
    name: record.name,
    role: record.role,
    avatarUrl: record.avatarUrl,
  };
}
