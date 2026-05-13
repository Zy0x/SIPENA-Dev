import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import JSZip from "jszip";

const isPreview = process.argv.includes("--preview");
const isProd = process.argv.includes("--prod") || !isPreview;
const forceApi = process.argv.includes("--api") || process.env.NETLIFY_DEPLOY_METHOD === "api";
const rootEnvPath = resolve(process.cwd(), ".env");
const publishDir = resolve(process.cwd(), "apps/frontend/dist");

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

async function addDirectoryToZip(zip, directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const zipPath = relative(publishDir, fullPath).split(sep).join("/");
    zip.file(zipPath, await readFile(fullPath));
  }
}

async function deployWithApi() {
  if (!existsSync(publishDir)) {
    fail("Folder build apps/frontend/dist tidak ditemukan. Jalankan build terlebih dahulu.");
  }

  const publishStat = await stat(publishDir);
  if (!publishStat.isDirectory()) {
    fail("apps/frontend/dist bukan folder build yang valid.");
  }

  const zip = new JSZip();
  await addDirectoryToZip(zip, publishDir);
  const body = await zip.generateAsync({
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    type: "nodebuffer",
  });

  const deployUrl = new URL(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`);
  if (!isProd) {
    deployUrl.searchParams.set("draft", "true");
  }

  const response = await fetch(deployUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/zip",
    },
    body,
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { message: responseText };
  }

  if (!response.ok) {
    fail(`Deploy API Netlify gagal (${response.status}): ${payload.message ?? response.statusText}`);
  }

  console.log("\n[netlify-deploy] Deploy API berhasil diterima Netlify.");
  console.log(`[netlify-deploy] Deploy ID : ${payload.id}`);
  console.log(`[netlify-deploy] Status    : ${payload.state}`);
  console.log(`[netlify-deploy] URL       : ${payload.deploy_ssl_url ?? payload.ssl_url ?? payload.url}`);
  if (payload.admin_url) {
    console.log(`[netlify-deploy] Admin     : ${payload.admin_url}`);
  }
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

if (!forceApi) {
  const cliCheck = spawnSync(netlifyBin, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  if (cliCheck.status === 0) {
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

    if (deploy.status === 0) {
      process.exit(0);
    }

    console.warn("\n[netlify-deploy] Netlify CLI gagal. Mencoba fallback deploy ZIP API.\n");
  } else {
    console.warn("\n[netlify-deploy] Netlify CLI tidak ditemukan. Mencoba fallback deploy ZIP API.\n");
  }
}

deployWithApi().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
