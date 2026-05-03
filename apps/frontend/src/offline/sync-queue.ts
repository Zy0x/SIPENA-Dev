export interface SyncQueueItem {
  id: string;
  type: string;
  payload: unknown;
}

export const syncQueue: SyncQueueItem[] = [];
