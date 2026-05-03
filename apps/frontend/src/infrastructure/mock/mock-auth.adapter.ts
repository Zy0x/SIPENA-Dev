import type { AuthPort } from "@/core/ports/auth.port";
import { mockUser } from "./mock-data";

export class MockAuthAdapter implements AuthPort {
  async login() {
    return { accessToken: "mock-token", user: mockUser };
  }

  async register() {
    return { accessToken: "mock-token", user: mockUser };
  }

  async logout() {}

  async getCurrentUser() {
    return mockUser;
  }
}
