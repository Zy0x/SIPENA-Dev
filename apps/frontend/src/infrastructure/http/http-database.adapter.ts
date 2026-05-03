import type { DatabasePort } from "@/core/ports/database.port";
import { httpRequest } from "./http.client";

export class HttpDatabaseAdapter implements DatabasePort {
  select<T>(table: string) {
    return httpRequest<T[]>(`/${table}`);
  }

  insert<T>(table: string, payload: unknown) {
    return httpRequest<T>(`/${table}`, { method: "POST", body: JSON.stringify(payload) });
  }

  update<T>(table: string, id: string, payload: unknown) {
    return httpRequest<T>(`/${table}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async remove(table: string, id: string) {
    await httpRequest<void>(`/${table}/${id}`, { method: "DELETE" });
  }
}
