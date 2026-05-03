import type { AuthSessionEntity } from "@/core/entities/session.entity";
import type { UserEntity } from "@/core/entities/user.entity";
import type { AuthPort } from "@/core/ports/auth.port";
import { httpRequest } from "./http.client";

export class HttpAuthAdapter implements AuthPort {
  login(email: string, password: string) {
    return httpRequest<AuthSessionEntity>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  }

  register(email: string, password: string) {
    return httpRequest<AuthSessionEntity>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
  }

  async logout() {
    await httpRequest<void>("/auth/logout", { method: "POST" });
  }

  getCurrentUser() {
    return httpRequest<UserEntity | null>("/auth/me");
  }
}
