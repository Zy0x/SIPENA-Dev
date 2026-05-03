import type { StoragePort } from "@/core/ports/storage.port";

export class HttpStorageAdapter implements StoragePort {
  async upload(_file: File, _path: string): Promise<string> {
    throw new Error("HttpStorageAdapter upload is not implemented. Add POST /api/files/upload in apps/backend first.");
  }

  async remove(_path: string): Promise<void> {
    throw new Error("HttpStorageAdapter remove is not implemented. Add DELETE /api/files/:path in apps/backend first.");
  }

  getPublicUrl(path: string) {
    return path;
  }
}
