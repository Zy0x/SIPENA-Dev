export const featureFlags = {
  pwaInstall: import.meta.env.VITE_FEATURE_PWA_INSTALL !== "false",
  offlineMode: import.meta.env.VITE_FEATURE_OFFLINE_MODE !== "false",
  realtime: import.meta.env.VITE_FEATURE_REALTIME !== "false",
  analytics: import.meta.env.VITE_FEATURE_ANALYTICS === "true",
  payments: import.meta.env.VITE_FEATURE_PAYMENTS === "true",
  betaDashboard: import.meta.env.VITE_FEATURE_BETA_DASHBOARD === "true",
};
