#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_OUTPUT = ".codex/viewport-observations/latest.json";
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 5000;

function parseArgs(argv) {
  const args = {
    days: DEFAULT_DAYS,
    limit: DEFAULT_LIMIT,
    output: DEFAULT_OUTPUT,
    stdout: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--stdout") {
      args.stdout = true;
      continue;
    }

    if (arg === "--days" && argv[index + 1]) {
      args.days = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === "--limit" && argv[index + 1]) {
      args.limit = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      args.output = argv[index + 1];
      index += 1;
    }
  }

  args.days = Number.isFinite(args.days) && args.days > 0 ? args.days : DEFAULT_DAYS;
  args.limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : DEFAULT_LIMIT;
  return args;
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

function getEnv(rootDir) {
  const localEnv = {
    ...readEnvFile(resolve(rootDir, ".env")),
    ...readEnvFile(resolve(rootDir, ".env.local")),
  };

  return {
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      localEnv.SUPABASE_URL ||
      localEnv.VITE_SUPABASE_URL,
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      localEnv.SUPABASE_SERVICE_ROLE_KEY ||
      localEnv.SUPABASE_SERVICE_KEY,
  };
}

function countBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function summarize(rows, sinceIso) {
  const numeric = (field) => rows.map((row) => Number(row[field])).filter((value) => Number.isFinite(value));
  const viewportSizes = countBy(rows, (row) => `${row.viewport_width}x${row.viewport_height}`);
  const profileCounts = countBy(rows, (row) => row.viewport_profile || "unknown");
  const routeCounts = countBy(rows, (row) => row.route_path || "/");
  const mobileFocusRows = rows.filter((row) => {
    const width = Number(row.viewport_width);
    const height = Number(row.viewport_height);
    return width <= 430 || height <= 480 || row.viewport_profile === "mobile-landscape";
  });

  return {
    generated_at: new Date().toISOString(),
    since: sinceIso,
    source_rows: rows.length,
    distinct_viewport_keys: new Set(rows.map((row) => row.viewport_key).filter(Boolean)).size,
    counts: {
      by_profile: profileCounts,
      by_route: routeCounts.slice(0, 20),
      by_orientation: countBy(rows, (row) => row.orientation || "unknown"),
      by_display_mode: countBy(rows, (row) => row.display_mode || "unknown"),
      with_display_cutout: rows.filter((row) => row.has_display_cutout).length,
    },
    top_viewports: viewportSizes.slice(0, 30),
    mobile_focus_viewports: countBy(
      mobileFocusRows,
      (row) => `${row.viewport_width}x${row.viewport_height}|${row.viewport_profile}|${row.orientation}`,
    ).slice(0, 30),
    safe_area_max: {
      top: Math.max(0, ...numeric("safe_area_top")),
      right: Math.max(0, ...numeric("safe_area_right")),
      bottom: Math.max(0, ...numeric("safe_area_bottom")),
      left: Math.max(0, ...numeric("safe_area_left")),
    },
    viewport_width: {
      p10: percentile(numeric("viewport_width"), 0.1),
      p50: percentile(numeric("viewport_width"), 0.5),
      p90: percentile(numeric("viewport_width"), 0.9),
    },
    viewport_height: {
      p10: percentile(numeric("viewport_height"), 0.1),
      p50: percentile(numeric("viewport_height"), 0.5),
      p90: percentile(numeric("viewport_height"), 0.9),
    },
  };
}

async function main() {
  const rootDir = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const { supabaseUrl, serviceRoleKey } = getEnv(rootDir);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL/VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dibutuhkan untuk sync viewport lokal.",
    );
  }

  const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("viewport_observations")
    .select(
      [
        "route_path",
        "viewport_profile",
        "viewport_width",
        "viewport_height",
        "visual_viewport_width",
        "visual_viewport_height",
        "screen_width",
        "screen_height",
        "device_pixel_ratio",
        "orientation",
        "display_mode",
        "touch_points",
        "safe_area_top",
        "safe_area_right",
        "safe_area_bottom",
        "safe_area_left",
        "has_display_cutout",
        "viewport_key",
        "observed_at",
      ].join(","),
    )
    .gte("observed_at", since)
    .order("observed_at", { ascending: false })
    .limit(args.limit);

  if (error) throw new Error(`Gagal membaca viewport_observations: ${error.message}`);

  const summary = summarize(data || [], since);

  if (args.stdout) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const outputPath = resolve(rootDir, args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Viewport observation summary written to ${args.output}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
