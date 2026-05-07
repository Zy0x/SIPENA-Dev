// Mirrors apps/frontend/dist to ./dist at repo root so platforms expecting
// the conventional Vite output location (Lovable dist-check) succeed alongside
// Netlify which uses apps/frontend/dist directly.
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "apps/frontend/dist");
const dest = resolve(root, "dist");

if (!existsSync(src)) {
  console.error(`[sync-root-dist] Source not found: ${src}`);
  process.exit(1);
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-root-dist] Copied ${src} -> ${dest}`);
