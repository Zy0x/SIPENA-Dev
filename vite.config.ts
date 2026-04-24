import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

/**
 * Generates /version.json into the build output.
 * The app polls this endpoint to detect new deployments reliably
 * without depending on Service Worker events.
 */
function versionJsonPlugin(): Plugin {
  return {
    name: "version-json",
    apply: "build",
    closeBundle() {
      mkdirSync(resolve(__dirname, "dist"), { recursive: true });
      const hash = createHash("sha256")
        .update(String(Date.now()))
        .digest("hex")
        .slice(0, 12);
      const payload = JSON.stringify({ version: hash, builtAt: new Date().toISOString() });
      writeFileSync(resolve(__dirname, "dist/version.json"), payload, "utf-8");
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionJsonPlugin(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icon.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: false, // Using manual manifest.json
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Exclude version.json from SW cache so it always fetches fresh
        navigateFallbackDenylist: [/\/version\.json/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
