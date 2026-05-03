import type { NotificationEntity } from "@/core/entities/notification.entity";

export function mapNotificationRecord(record: Partial<NotificationEntity>): NotificationEntity {
  return {
    id: record.id ?? "",
    title: record.title ?? "",
    message: record.message,
    read: Boolean(record.read),
    createdAt: record.createdAt ?? new Date(0).toISOString(),
  };
}
