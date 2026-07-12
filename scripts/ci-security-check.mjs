import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenEnvironmentFiles = trackedFiles.filter((file) => {
  const name = file.split("/").at(-1) || "";
  return name.startsWith(".env") && !name.endsWith(".example");
});

const ignoredExtensions = new Set([
  ".avif", ".gif", ".ico", ".jpeg", ".jpg", ".lock", ".pdf", ".png", ".ttf", ".webp", ".woff", ".woff2", ".xlsx",
]);
const ignoredFiles = new Set(["scripts/ci-security-check.mjs"]);
const secretPatterns = [
  { label: "private key", expression: new RegExp("-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----") },
  { label: "GitHub token", expression: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: "OpenAI-compatible API key", expression: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  { label: "Telegram bot token", expression: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/ },
  { label: "Supabase service-role JWT", expression: /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  {
    label: "plaintext privileged secret",
    expression: /(?:ADMIN_DB_PASSWORD|SERVICE_ROLE_KEY|CANARY_PASSWORD|WEBHOOK_KEY)\s*[:=]\s*["'](?!\s*$|\$(?:\{|[A-Za-z_])|Deno\.env|process\.env)[^"'\r\n]{8,}["']/,
  },
];

const findings = [];
for (const file of trackedFiles) {
  if (ignoredFiles.has(file) || ignoredExtensions.has(extname(file).toLowerCase())) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of secretPatterns) {
    if (pattern.expression.test(content)) findings.push(`${file}: ${pattern.label}`);
  }
}

if (forbiddenEnvironmentFiles.length > 0 || findings.length > 0) {
  console.error("[security-check] Build diblokir karena material sensitif terdeteksi.");
  forbiddenEnvironmentFiles.forEach((file) => console.error(`- ${file}: environment file tidak boleh dilacak`));
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`[security-check] OK: ${trackedFiles.length} tracked files diperiksa; tidak ada secret mentah atau .env terlarang.`);
