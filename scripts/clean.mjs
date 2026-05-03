import { rm } from "node:fs/promises";

const targets = ["apps/frontend/dist", "apps/backend/dist", "dist"];

for (const target of targets) {
  await rm(target, { recursive: true, force: true });
}
