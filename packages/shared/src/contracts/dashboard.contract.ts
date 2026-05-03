import type { ApiResponse } from "../types/api-response";

export interface DashboardContract {
  "GET /api/health": ApiResponse<{ ok: boolean }>;
}
