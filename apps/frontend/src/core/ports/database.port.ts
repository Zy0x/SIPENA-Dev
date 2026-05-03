export interface DatabasePort {
  select<T>(table: string, query?: Record<string, unknown>): Promise<T[]>;
  insert<T>(table: string, payload: unknown): Promise<T>;
  update<T>(table: string, id: string, payload: unknown): Promise<T>;
  remove(table: string, id: string): Promise<void>;
  rpc?<T>(name: string, params?: Record<string, unknown>): Promise<T>;
}
