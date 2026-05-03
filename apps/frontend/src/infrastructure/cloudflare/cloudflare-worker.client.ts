import { httpRequest } from "@/infrastructure/http/http.client";

export function callCloudflareWorker<T>(path: string, init?: RequestInit): Promise<T> {
  return httpRequest<T>(path, init);
}
