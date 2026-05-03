import type { StoragePort } from "@/core/ports/storage.port";

export class CloudflareR2StorageAdapter implements StoragePort {
  upload(_file: File, _path: string): Promise<string> {
    throw new Error("Cloudflare R2 adapter belum dihubungkan. Set VITE_STORAGE_PROVIDER=http atau implementasikan signed upload.");
  }

  remove(_path: string): Promise<void> {
    throw new Error("Cloudflare R2 adapter belum dihubungkan. Gunakan backend untuk operasi delete.");
  }

  getPublicUrl(path: string): string {
    return path;
  }
}
