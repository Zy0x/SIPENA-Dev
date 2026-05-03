import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

const buildVersion = createHash("sha256")
  .update(`${Date.now()}-${Math.random()}`)
  .digest("hex")
  .slice(0, 12);

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
      const payload = JSON.stringify({ version: buildVersion, builtAt: new Date().toISOString() });
      writeFileSync(resolve(__dirname, "dist/version.json"), payload, "utf-8");
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: __dirname,
  envDir: resolve(__dirname, "../.."),
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
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
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024, // Export styling increases the main offline chunk.
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
      "@app": path.resolve(__dirname, "./src/app"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@infra": path.resolve(__dirname, "./src/infrastructure"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
}));
