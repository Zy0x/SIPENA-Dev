import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const isPreview = process.argv.includes("--preview");
const isProd = process.argv.includes("--prod") || !isPreview;
const rootEnvPath = resolve(process.cwd(), ".env");

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf-8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(rootEnvPath);

const siteId = process.env.NETLIFY_SITE_ID;
const authToken = process.env.NETLIFY_AUTH_TOKEN;
const netlifyBin = process.env.NETLIFY_CLI_BIN || "netlify";

function fail(message) {
  console.error(`\n[netlify-deploy] ${message}\n`);
  process.exit(1);
}

if (!siteId) {
  fail("NETLIFY_SITE_ID belum diisi. Ambil Project ID dari Netlify lalu simpan di environment lokal/CI.");
}

if (!authToken) {
  fail("NETLIFY_AUTH_TOKEN belum diisi. Buat Personal Access Token Netlify lalu simpan di environment lokal/CI.");
}

const cliCheck = spawnSync(netlifyBin, ["--version"], {
  stdio: "ignore",
  shell: process.platform === "win32",
});

if (cliCheck.error?.code === "ENOENT" || cliCheck.status !== 0) {
  fail("Netlify CLI tidak ditemukan. Install global `npm install -g netlify-cli` atau set NETLIFY_CLI_BIN ke lokasi binary Netlify CLI.");
}

const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const deployArgs = [
  "deploy",
  "--dir",
  "apps/frontend/dist",
  "--site",
  siteId,
  "--auth",
  authToken,
];

if (isProd) {
  deployArgs.push("--prod");
}

const deploy = spawnSync(netlifyBin, deployArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(deploy.status ?? 1);
