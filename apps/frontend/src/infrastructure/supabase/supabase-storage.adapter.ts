import type { StoragePort } from "@/core/ports/storage.port";
import { supabaseExternal } from "./supabase-client";

export class SupabaseStorageAdapter implements StoragePort {
  constructor(private readonly bucket = "public") {}

  async upload(file: File, path: string) {
    const { data, error } = await supabaseExternal.storage.from(this.bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return data.path;
  }

  async remove(path: string) {
    const { error } = await supabaseExternal.storage.from(this.bucket).remove([path]);
    if (error) throw error;
  }

  getPublicUrl(path: string) {
    return supabaseExternal.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }
}
