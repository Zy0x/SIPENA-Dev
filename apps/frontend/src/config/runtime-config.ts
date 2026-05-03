import { providerConfig } from "./provider.config";

export interface RuntimeConfig {
  apiBaseUrl: string;
  authProvider: string;
  dataProvider: string;
  storageProvider: string;
  realtimeProvider: string;
  maintenanceMode: boolean;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (response.ok) return await response.json();
  } catch {
    // Fall back to build-time env. Runtime config is optional.
  }

  return {
    apiBaseUrl: providerConfig.apiBaseUrl,
    authProvider: providerConfig.auth,
    dataProvider: providerConfig.data,
    storageProvider: providerConfig.storage,
    realtimeProvider: providerConfig.realtime,
    maintenanceMode: false,
  };
}
