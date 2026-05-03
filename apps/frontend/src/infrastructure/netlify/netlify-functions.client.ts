import { httpRequest } from "@/infrastructure/http/http.client";

export function callNetlifyFunction<T>(name: string, init?: RequestInit): Promise<T> {
  return httpRequest<T>(`/.netlify/functions/${name}`, init);
}
