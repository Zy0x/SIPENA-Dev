import type { ApiResponse } from "../types/api-response";
import type { SharedAuthSession } from "../types/auth";
import type { SharedUser } from "../types/user";

export interface AuthContract {
  "POST /api/auth/login": ApiResponse<SharedAuthSession>;
  "POST /api/auth/register": ApiResponse<SharedAuthSession>;
  "POST /api/auth/logout": ApiResponse<null>;
  "GET /api/auth/me": ApiResponse<SharedUser | null>;
}
