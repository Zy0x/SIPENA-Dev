export interface NotificationEntity {
  id: string;
  title: string;
  message?: string | null;
  read?: boolean;
  createdAt?: string;
}
