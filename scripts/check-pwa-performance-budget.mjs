import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "apps/frontend/dist");
const budgets = {
  entryRaw: 700 * 1024,
  entryGzip: 220 * 1024,
  cssRaw: 360 * 1024,
  cssGzip: 60 * 1024,
  precache: 3.5 * 1024 * 1024,
};
const failures = [];

function sizeOf(relativePath) {
  const absolutePath = resolve(dist, relativePath.replace(/^\//, ""));
  if (!existsSync(absolutePath)) return { raw: 0, gzip: 0 };
  const content = readFileSync(absolutePath);
  return { raw: content.length, gzip: gzipSync(content).length };
}

function assertBudget(label, actual, budget) {
  if (actual > budget) failures.push(`${label}: ${actual} > ${budget}`);
}

if (!existsSync(resolve(dist, "index.html")) || !existsSync(resolve(dist, "sw.js"))) {
  throw new Error("Build artifact tidak ditemukan. Jalankan npm run build terlebih dahulu.");
}

const html = readFileSync(resolve(dist, "index.html"), "utf8");
const entry = html.match(/<script[^>]+src="\/([^\"]+index-[^\"]+\.js)"/)?.[1];
const css = html.match(/<link[^>]+rel="stylesheet"[^>]+href="\/([^\"]+\.css)"/)?.[1];
if (!entry || !css) throw new Error("Entry JavaScript atau CSS utama tidak dapat dikenali dari index.html.");

const entrySize = sizeOf(entry);
const cssSize = sizeOf(css);
assertBudget("entry raw", entrySize.raw, budgets.entryRaw);
assertBudget("entry gzip", entrySize.gzip, budgets.entryGzip);
assertBudget("CSS raw", cssSize.raw, budgets.cssRaw);
assertBudget("CSS gzip", cssSize.gzip, budgets.cssGzip);

const sw = readFileSync(resolve(dist, "sw.js"), "utf8");
const precacheUrls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]))];
const precacheBytes = precacheUrls.reduce((total, url) => {
  const filePath = resolve(dist, url);
  return total + (existsSync(filePath) ? statSync(filePath).size : 0);
}, 0);
assertBudget("precache", precacheBytes, budgets.precache);

const forbidden = ["pdf", "xlsx", "excel", "jszip", "ocr", "katex", "morphe", "tour", "export", ".gif"];
const forbiddenPrecache = precacheUrls.filter((url) => forbidden.some((token) => url.toLowerCase().includes(token)));
if (forbiddenPrecache.length > 0) failures.push(`dependency berat masuk precache: ${forbiddenPrecache.join(", ")}`);

const startupDependencies = [...html.matchAll(/rel="modulepreload"[^>]+href="\/([^"]+)"/g)].map((match) => match[1]);
const forbiddenStartup = startupDependencies.filter((url) => forbidden.some((token) => url.toLowerCase().includes(token)));
if (forbiddenStartup.length > 0) failures.push(`dependency berat masuk startup: ${forbiddenStartup.join(", ")}`);

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`[perf:budget] entry ${formatKb(entrySize.raw)} raw / ${formatKb(entrySize.gzip)} gzip`);
console.log(`[perf:budget] CSS ${formatKb(cssSize.raw)} raw / ${formatKb(cssSize.gzip)} gzip`);
console.log(`[perf:budget] precache ${precacheUrls.length} file unik / ${formatKb(precacheBytes)}`);
console.log("[perf:budget] aset navigasi Android: 0 KB GIF (fallback Lucide runtime)");

if (failures.length > 0) {
  console.error("[perf:budget] GAGAL\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("[perf:budget] LULUS");
