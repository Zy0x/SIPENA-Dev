import type { StoragePort } from "@/core/ports/storage.port";

export class MockStorageAdapter implements StoragePort {
  async upload(_file: File, path: string) { return path; }
  async remove() {}
  getPublicUrl(path: string) { return path; }
}
