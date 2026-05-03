import type { AuthSessionEntity } from "../entities/session.entity";
import type { UserEntity } from "../entities/user.entity";

export interface AuthPort {
  login(email: string, password: string): Promise<AuthSessionEntity>;
  register(email: string, password: string): Promise<AuthSessionEntity>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<UserEntity | null>;
  refreshSession?(): Promise<AuthSessionEntity | null>;
}
