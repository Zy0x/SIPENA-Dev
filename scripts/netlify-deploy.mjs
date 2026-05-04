import { spawnSync } from "node:child_process";

const isPreview = process.argv.includes("--preview");
const isProd = process.argv.includes("--prod") || !isPreview;
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

if (deploy.error?.code === "ENOENT") {
  fail("Netlify CLI tidak ditemukan. Install global `npm install -g netlify-cli` atau set NETLIFY_CLI_BIN ke lokasi binary Netlify CLI.");
}

process.exit(deploy.status ?? 1);
