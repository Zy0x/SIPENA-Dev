import type { UserEntity } from "./user.entity";

export interface AuthSessionEntity {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  user: UserEntity;
}
