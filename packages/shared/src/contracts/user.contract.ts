import type { ApiResponse } from "../types/api-response";
import type { SharedUser } from "../types/user";

export interface UserContract {
  "GET /api/users/me": ApiResponse<SharedUser>;
  "PATCH /api/users/me": ApiResponse<SharedUser>;
}
