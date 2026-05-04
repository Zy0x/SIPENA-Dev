import type { DatabasePort } from "@/core/ports/database.port";
import { mapProviderError } from "@/core/errors/error-mapper";
import { supabaseExternal } from "./supabase-client";

type QueryResult<T = unknown> = { data: T | null; error: unknown };
type SupabaseQueryBuilder = {
  select: (columns?: string) => Promise<QueryResult<unknown[]>>;
  insert: (payload: unknown) => { select: () => { single: () => Promise<QueryResult> } };
  update: (payload: unknown) => { eq: (column: string, value: string) => { select: () => { single: () => Promise<QueryResult> } } };
  delete: () => { eq: (column: string, value: string) => Promise<QueryResult> };
};
type UntypedSupabaseClient = {
  from: (table: string) => SupabaseQueryBuilder;
};

const databaseClient = supabaseExternal as unknown as UntypedSupabaseClient;

export class SupabaseDatabaseAdapter implements DatabasePort {
  async select<T>(table: string): Promise<T[]> {
    const { data, error } = await databaseClient.from(table).select("*");
    if (error) throw mapProviderError(error, `Supabase select failed for ${table}`);
    return (data ?? []) as T[];
  }

  async insert<T>(table: string, payload: unknown): Promise<T> {
    const { data, error } = await databaseClient.from(table).insert(payload).select().single();
    if (error) throw mapProviderError(error, `Supabase insert failed for ${table}`);
    return data as T;
  }

  async update<T>(table: string, id: string, payload: unknown): Promise<T> {
    const { data, error } = await databaseClient.from(table).update(payload).eq("id", id).select().single();
    if (error) throw mapProviderError(error, `Supabase update failed for ${table}`);
    return data as T;
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await databaseClient.from(table).delete().eq("id", id);
    if (error) throw mapProviderError(error, `Supabase delete failed for ${table}`);
  }
}
