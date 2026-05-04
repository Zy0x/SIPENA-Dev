import { rm } from "node:fs/promises";

const targets = [
  "apps/frontend/dist",
  "apps/backend/dist",
  "dist",
  ".vite-preview.log",
  ".vite-preview.err.log",
  "tsconfig.tsbuildinfo",
  "apps/frontend/tsconfig.app.tsbuildinfo",
  "apps/frontend/tsconfig.node.tsbuildinfo",
  "apps/backend/tsconfig.tsbuildinfo",
];

for (const target of targets) {
  await rm(target, { recursive: true, force: true });
  console.log(`[clean] removed ${target}`);
}
