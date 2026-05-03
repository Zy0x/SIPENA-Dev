import { providerConfig } from "@/config/provider.config";

export async function httpRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${providerConfig.apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
