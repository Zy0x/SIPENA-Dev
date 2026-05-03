import type { ApiResponse } from "../types/api-response";

export interface NotificationContract {
  "GET /api/notifications": ApiResponse<Array<{ id: string; title: string; read: boolean }>>;
}
