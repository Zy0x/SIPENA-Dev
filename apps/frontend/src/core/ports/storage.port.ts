export interface StoragePort {
  upload(file: File, path: string): Promise<string>;
  remove(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}
