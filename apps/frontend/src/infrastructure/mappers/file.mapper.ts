import type { FileEntity } from "@/core/entities/file.entity";

export function mapFileRecord(record: Partial<FileEntity>): FileEntity {
  return {
    id: record.id ?? "",
    path: record.path ?? "",
    publicUrl: record.publicUrl,
    size: record.size,
    contentType: record.contentType,
  };
}
