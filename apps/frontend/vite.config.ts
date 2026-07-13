import { defineConfig, loadEnv, type Plugin } from "vite";
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

const envDir = resolve(__dirname, "../..");

function validateProductionEnv(mode: string) {
  if (mode !== "production") return;

  const env = loadEnv(mode, envDir, "");
  const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    console.warn(
      `[config] Production build missing ${missing.join(", ")}. Continuing — ensure these are set in the deployment environment (Netlify).`,
    );
    return;
  }

  try {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (!url.hostname.endsWith(".supabase.co")) {
      throw new Error("URL must point to a Supabase project host");
    }
  } catch {
    console.warn("[config] VITE_SUPABASE_URL is not a valid Supabase project URL.");
  }
}

export default defineConfig(({ mode }) => {
  validateProductionEnv(mode);

  return {
    root: __dirname,
    envDir,
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
      manifest: false, // Using manual manifest.json
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: null,
        // Keep install light on Android. Feature chunks are cached after first use.
        globPatterns: [
          "index.html",
          "assets/index-*.{js,css}",
          "assets/vendor-react-*.js",
          "assets/vendor-data-*.js",
          "assets/vendor-radix-*.js",
          "assets/workbox-window*.js",
          "manifest.json",
          "manifest.webmanifest",
          "sipena-icon-*-v2.png",
          "sipena-apple-touch-v2.png",
          "fonts/plus-jakarta-sans-latin.woff2",
        ],
        globIgnores: [
          "**/*pdf*",
          "**/*xlsx*",
          "**/*excel*",
          "**/*zip*",
          "**/*ocr*",
          "**/*katex*",
          "**/*morphe*",
          "**/*tour*",
          "**/*export*",
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        manifestTransforms: [async (entries) => ({
          manifest: entries.filter((entry) => !entry.url.startsWith("assets/Index-")),
          warnings: [],
        })],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "sipena-navigation-v1",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/")) &&
              ["script", "style", "worker", "font", "image"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "sipena-runtime-assets-v1",
              expiration: {
                maxEntries: 90,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/node_modules[\\/](@?react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return "vendor-react";
            }
            if (id.includes("node_modules/@tanstack/") || id.includes("node_modules/@supabase/")) {
              return "vendor-data";
            }
            if (id.includes("node_modules/@radix-ui/")) {
              return "vendor-radix";
            }
            return undefined;
          },
        },
      },
    },
  };
});
