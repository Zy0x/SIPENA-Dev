import { build } from "esbuild";
import { join } from "node:path";

const rootDir = process.cwd();

build({
  entryPoints: [join(rootDir, "src/main.ts")],
  bundle: true,
  outfile: join(rootDir, "dist/main.js"),
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: true,
  minify: false,
  external: [], // Kita bundle semuanya agar zero-dependency di runtime
}).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
