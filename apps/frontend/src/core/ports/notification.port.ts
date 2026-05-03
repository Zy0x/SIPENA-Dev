import type { NotificationEntity } from "../entities/notification.entity";

export interface NotificationPort {
  list(): Promise<NotificationEntity[]>;
  markRead(id: string): Promise<void>;
}
