import { cp, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const appDist = resolve("apps/frontend/dist");
const rootDist = resolve("dist");

try {
  const distStats = await stat(appDist);
  if (!distStats.isDirectory()) {
    throw new Error(`${appDist} is not a directory`);
  }
} catch (error) {
  throw new Error(
    `Cannot sync root dist because apps/frontend/dist is missing. Run the frontend build first. ${error.message}`,
  );
}

await rm(rootDist, { recursive: true, force: true });
await cp(appDist, rootDist, { recursive: true });
