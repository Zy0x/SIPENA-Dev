import type { DatabasePort } from "@/core/ports/database.port";

export class MockDatabaseAdapter implements DatabasePort {
  async select<T>(): Promise<T[]> { return []; }
  async insert<T>(_table: string, payload: unknown): Promise<T> { return payload as T; }
  async update<T>(_table: string, _id: string, payload: unknown): Promise<T> { return payload as T; }
  async remove(): Promise<void> {}
}
