import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SITE_URL = "https://sipenadev.netlify.app";
const DEFAULT_DIST_DIR = "apps/frontend/dist";
const CACHE_BUST = `sipena-blank-guard-${Date.now()}`;

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

function log(prefix, message) {
  console.log(`${prefix} ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function withCacheBust(url) {
  const parsed = new URL(url);
  parsed.searchParams.set("codex_blank_guard", CACHE_BUST);
  return parsed.toString();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    return await fetch(url, {
      ...options,
      headers: {
        "Cache-Control": "no-cache",
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractAssetPaths(html) {
  const paths = new Set();
  const assetPattern = /(?:src|href)=["']([^"']+\.(?:js|mjs|css)(?:\?[^"']*)?)["']/gi;
  let match;

  while ((match = assetPattern.exec(html)) !== null) {
    const assetPath = match[1];
    if (!assetPath.startsWith("http://") && !assetPath.startsWith("https://")) {
      paths.add(assetPath);
    }
  }

  return [...paths];
}

function resolveAssetUrl(siteUrl, assetPath) {
  return new URL(assetPath, siteUrl).toString();
}

function isHtmlResponse(contentType, bodyStart) {
  const lowerType = contentType.toLowerCase();
  const lowerBody = bodyStart.trimStart().toLowerCase();
  return lowerType.includes("text/html") || lowerBody.startsWith("<!doctype html") || lowerBody.startsWith("<html");
}

export function verifyLocalDist(distDir = DEFAULT_DIST_DIR, options = {}) {
  const prefix = options.logPrefix ?? "[web-blank-guard]";
  const resolvedDist = resolve(process.cwd(), distDir);
  const indexPath = join(resolvedDist, "index.html");

  if (!existsSync(indexPath)) {
    fail(`index.html tidak ditemukan di ${resolvedDist}. Jalankan build terlebih dahulu.`);
  }

  const html = readFileSync(indexPath, "utf-8");
  const assets = extractAssetPaths(html);
  if (assets.length === 0) {
    fail("index.html tidak mereferensikan asset JS/CSS build.");
  }

  for (const assetPath of assets) {
    if (assetPath.startsWith("//")) {
      continue;
    }

    const cleanPath = assetPath.replace(/^\//, "").split("?")[0];
    const filePath = join(resolvedDist, cleanPath);
    if (!existsSync(filePath)) {
      fail(`Asset build hilang: ${assetPath}`);
    }
  }

  log(prefix, `Local dist OK: ${assets.length} asset JS/CSS ditemukan.`);
  return { indexPath, assets };
}

export async function verifyRemoteAssets(siteUrl = DEFAULT_SITE_URL, options = {}) {
  const prefix = options.logPrefix ?? "[web-blank-guard]";
  const normalizedSiteUrl = new URL(siteUrl).toString();
  const indexResponse = await fetchWithTimeout(withCacheBust(normalizedSiteUrl), { timeoutMs: options.timeoutMs });

  if (!indexResponse.ok) {
    fail(`Homepage gagal diakses (${indexResponse.status}) pada ${normalizedSiteUrl}`);
  }

  const html = await indexResponse.text();
  if (!html.includes('id="root"')) {
    fail("Homepage tidak memiliki elemen #root untuk React.");
  }

  const assets = extractAssetPaths(html);
  if (assets.length === 0) {
    fail("Homepage production tidak mereferensikan asset JS/CSS.");
  }

  for (const assetPath of assets) {
    const assetUrl = withCacheBust(resolveAssetUrl(normalizedSiteUrl, assetPath));
    const assetResponse = await fetchWithTimeout(assetUrl, { timeoutMs: options.timeoutMs });
    const contentType = assetResponse.headers.get("content-type") ?? "";
    const body = await assetResponse.text();
    const bodyStart = body.slice(0, 160);

    if (!assetResponse.ok) {
      fail(`Asset production gagal diakses (${assetResponse.status}): ${assetPath}`);
    }

    if (isHtmlResponse(contentType, bodyStart)) {
      fail(`Asset production berubah menjadi HTML fallback: ${assetPath}`);
    }

    if (assetPath.match(/\.css(?:\?|$)/) && !contentType.toLowerCase().includes("text/css")) {
      fail(`Asset CSS punya content-type tidak valid (${contentType || "kosong"}): ${assetPath}`);
    }

    if (assetPath.match(/\.(?:js|mjs)(?:\?|$)/) && !contentType.toLowerCase().includes("javascript")) {
      fail(`Asset JS punya content-type tidak valid (${contentType || "kosong"}): ${assetPath}`);
    }

    if (body.length < 256) {
      fail(`Asset production terlalu kecil dan berisiko rusak: ${assetPath}`);
    }
  }

  log(prefix, `Remote assets OK: ${assets.length} asset JS/CSS valid di ${normalizedSiteUrl}`);
  return { siteUrl: normalizedSiteUrl, assets };
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe") : "",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function rootLooksRendered(dom) {
  const rootMatch = dom.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>\s*<script>/i);
  if (!rootMatch) return false;

  const rootInner = rootMatch[1].trim();
  return rootInner.length > 500 && /SIPENA|Dashboard|Masuk|Daftar|Input Nilai/i.test(rootInner);
}

export function verifyHeadlessRender(siteUrl = DEFAULT_SITE_URL, options = {}) {
  const prefix = options.logPrefix ?? "[web-blank-guard]";
  const chromePath = findChromeExecutable();

  if (!chromePath) {
    if (options.requireChrome) {
      fail("Chrome/Chromium headless tidak ditemukan untuk render smoke test.");
    }
    log(prefix, "Chrome headless tidak tersedia; render smoke dilewati setelah asset check.");
    return { skipped: true };
  }

  const userDataDir = mkdtempSync(join(tmpdir(), "sipena-blank-guard-"));
  try {
    const result = spawnSync(
      chromePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        `--user-data-dir=${userDataDir}`,
        "--virtual-time-budget=15000",
        "--dump-dom",
        withCacheBust(siteUrl),
      ],
      {
        encoding: "utf-8",
        maxBuffer: 30 * 1024 * 1024,
      },
    );

    const dom = result.stdout ?? "";
    if (!rootLooksRendered(dom)) {
      const stderr = (result.stderr ?? "").split(/\r?\n/).slice(0, 8).join(" ");
      fail(`Render headless masih terlihat blank atau #root kosong. ${stderr}`.trim());
    }

    log(prefix, "Headless render OK: #root berisi UI React.");
    return { skipped: false };
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

export async function verifyRemoteSite(siteUrl = DEFAULT_SITE_URL, options = {}) {
  await verifyRemoteAssets(siteUrl, options);

  if (options.render !== false) {
    verifyHeadlessRender(siteUrl, options);
  }
}

async function main() {
  loadDotEnv(resolve(process.cwd(), ".env"));

  const args = process.argv.slice(2);
  const distIndex = args.indexOf("--dist");
  const urlIndex = args.indexOf("--url");
  const noRender = args.includes("--no-render");
  const requireChrome = args.includes("--require-chrome");
  const prefix = "[web-blank-guard]";

  if (distIndex !== -1) {
    verifyLocalDist(args[distIndex + 1] || DEFAULT_DIST_DIR, { logPrefix: prefix });
  }

  const shouldVerifyRemote = urlIndex !== -1 || distIndex === -1;
  if (shouldVerifyRemote) {
    const siteUrl = args[urlIndex + 1] || process.env.NETLIFY_SITE_URL || DEFAULT_SITE_URL;
    await verifyRemoteSite(siteUrl, {
      logPrefix: prefix,
      render: !noRender,
      requireChrome,
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`\n[web-blank-guard] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
