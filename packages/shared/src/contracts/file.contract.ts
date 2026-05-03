import type { ApiResponse } from "../types/api-response";

export interface FileContract {
  "POST /api/files/upload": ApiResponse<{ url: string; path: string }>;
}
