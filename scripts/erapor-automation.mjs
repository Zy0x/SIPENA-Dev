import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const DEFAULT_BASE_URL = "http://localhost:8535";
const DEFAULT_SEMESTER_CODE = "20252";
const DEFAULT_SEMESTER_KE = "2";
const DEFAULT_SCHOOL_NAME = " SD NEGERI BELITUNG SELATAN 7";

function parseArgs(argv) {
  const args = {
    phase: "all",
    baseUrl: process.env.ERAPOR_BASE_URL || DEFAULT_BASE_URL,
    semester: process.env.ERAPOR_SEMESTER || DEFAULT_SEMESTER_CODE,
    semesterKe: process.env.ERAPOR_SEMESTER_KE || DEFAULT_SEMESTER_KE,
    className: process.env.ERAPOR_CLASS_NAME || "",
    subjectName: process.env.ERAPOR_SUBJECT_NAME || "",
    gradesPath: "",
    output: "",
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const normalizedKey = key === "grades" ? "gradesPath" : key;
      args[normalizedKey] = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function loadDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function requireSecret(env, key) {
  const value = env[key] || process.env[key];
  if (!value) throw new Error(`Missing ${key}. Set it in .env or the shell environment.`);
  return value;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function sha512(text) {
  return crypto.createHash("sha512").update(text).digest("hex");
}

function parseOptions(html, selectId) {
  const selectMatch = html.match(new RegExp(`<select[^>]+id=["']${selectId}["'][\\s\\S]*?<\\/select>`, "i"));
  if (!selectMatch) return [];
  return [...selectMatch[0].matchAll(/<option[^>]*value=['"]?([^'">\s]*)['"]?[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({
      id: decodeHtml(match[1]).trim(),
      label: decodeHtml(match[2]).replace(/\s+/g, " ").trim(),
    }))
    .filter((option) => option.id);
}

function decodeHtml(text) {
  return String(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function selectByName(items, requestedName, fallbackLabel) {
  if (!items.length) throw new Error(`No ${fallbackLabel} found.`);
  if (!requestedName) return items[0];
  const needle = requestedName.toLowerCase();
  return (
    items.find((item) => item.label.toLowerCase() === needle) ||
    items.find((item) => item.label.toLowerCase().includes(needle)) ||
    items[0]
  );
}

class EraporSession {
  constructor(baseUrl) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.cookieJar = new Map();
  }

  absorbCookies(headers) {
    const setCookie = headers.get("set-cookie");
    if (!setCookie) return;
    for (const cookie of setCookie.split(/,(?=[^;,]+=)/)) {
      const pair = cookie.split(";")[0].trim();
      if (!pair) continue;
      this.cookieJar.set(pair.split("=")[0], pair);
    }
  }

  cookieHeader() {
    return [...this.cookieJar.values()].join("; ");
  }

  async request(pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    const response = await fetch(url, {
      redirect: "manual",
      ...options,
      headers: {
        ...(options.headers || {}),
        cookie: this.cookieHeader(),
      },
    });
    this.absorbCookies(response.headers);
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      response,
      text: () => buffer.toString("utf8"),
      buffer,
    };
  }

  async postForm(pathName, values) {
    return this.request(pathName, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: new URLSearchParams(values).toString(),
    });
  }
}

async function login(session, env, args) {
  const username = requireSecret(env, "ACCOUNT_ERAPOR");
  const plainPassword = requireSecret(env, "PASSWORD_ERAPOR");
  const loginPage = await session.request("/login");
  const loginHtml = loginPage.text();
  const schools = parseOptions(loginHtml, "sekolahid");
  const semesters = parseOptions(loginHtml, "semester");
  const school = selectByName(schools, process.env.ERAPOR_SCHOOL_NAME || "", "school");
  const semester = semesters.find((item) => item.id === args.semester) || semesters[0];

  const result = await session.postForm("/login/cekuser", {
    username,
    pass: plainPassword,
    semester: semester.id,
    sekolahid: school.id,
    nm_sek: school.label || DEFAULT_SCHOOL_NAME,
    password: sha512(plainPassword),
  });

  const body = result.text();
  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Login returned non-JSON response with status ${result.response.status}.`);
  }

  if (parsed.type !== "success") {
    throw new Error(`E-Rapor login failed: ${parsed.message || "unknown error"}`);
  }

  return { school, semester, message: parsed.message };
}

async function discover(session, args) {
  const importPage = await session.request("/import_nil_rapor");
  const importHtml = importPage.text();
  const classes = parseOptions(importHtml, "kelas");
  const selectedClass = selectByName(classes, args.className, "class");
  const subjectsResponse = await session.postForm("/mapelgurunya", { idkelas: selectedClass.id });
  const subjects = JSON.parse(subjectsResponse.text()).map((subject) => ({
    id: String(subject.mata_pelajaran_id),
    label: String(subject.nm_mapel).replace(/\s+/g, " ").trim(),
  }));
  const selectedSubject = selectByName(subjects, args.subjectName || "matematika", "subject");
  return { classes, subjects, selectedClass, selectedSubject };
}

async function downloadTemplate(session, args, selectedClass, selectedSubject) {
  const probe = await session.postForm("/buka_format_import", {
    idkelas: selectedClass.id,
    mapel: selectedSubject.id,
    semesterke: args.semesterKe,
  });
  const formHtml = probe.text();
  const csrf = formHtml.match(/name=["']csrf_test_name["']\s+value=["']([^"']+)/i)?.[1] || "";
  const filePathResponse = await session.postForm("/format_import_rapor", {
    idkelas: selectedClass.id,
    namakelas: ` ${selectedClass.label} `,
    mapel: selectedSubject.id,
    nmmapel: selectedSubject.label,
  });
  const remotePath = filePathResponse.text().trim();
  if (!remotePath || remotePath === "gagal") {
    throw new Error("E-Rapor did not return an import template path.");
  }
  const download = await session.request(`/${remotePath.replace(/^\/+/, "")}`);
  if (download.response.status !== 200) {
    throw new Error(`Template download failed with HTTP ${download.response.status}.`);
  }
  const safeName = path.basename(remotePath).replace(/[\\/:*?"<>|]/g, "_");
  const outDir = path.join(os.tmpdir(), "sipena-erapor");
  fs.mkdirSync(outDir, { recursive: true });
  const localPath = path.join(outDir, safeName);
  fs.writeFileSync(localPath, download.buffer);
  return { localPath, remotePath, csrf, formHtml };
}

function inspectTemplate(templatePath) {
  const workbook = XLSX.readFile(templatePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });
  const headerRow = rows[2] || [];
  const codeRow = rows[5] || [];
  const tpColumns = [];
  for (let col = 7; col < Math.max(headerRow.length, codeRow.length); col += 1) {
    const code = String(codeRow[col] || "").trim();
    if (/^TP\./i.test(code)) {
      tpColumns.push({
        columnIndex: col,
        code,
        description: String(rows[4]?.[col] || "")
          .replace(/\s+/g, " ")
          .trim(),
      });
    }
  }
  const students = rows
    .map((row, index) => ({
      rowNumber: index + 1,
      nisn: String(row[4] || "").trim(),
      name: String(row[5] || "").trim(),
    }))
    .filter((row) => row.nisn || row.name)
    .filter((row) => row.rowNumber >= 7);
  return {
    workbook,
    sheetName,
    worksheet,
    title: rows[0]?.[0] || "",
    metadata: rows[1]?.slice(0, 8) || [],
    tpColumns,
    students,
  };
}

function loadGrades(gradesPath) {
  if (!gradesPath) return [];
  const raw = JSON.parse(fs.readFileSync(gradesPath, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.rows)) return raw.rows;
  throw new Error("Grades JSON must be an array or an object with a rows array.");
}

function fillTemplate(templatePath, grades, outputPath) {
  const model = inspectTemplate(templatePath);
  const byNisn = new Map(grades.map((row) => [String(row.nisn || "").trim(), row]));
  const byName = new Map(
    grades.map((row) => [
      String(row.name || "")
        .trim()
        .toLowerCase(),
      row,
    ]),
  );
  let matched = 0;

  for (const student of model.students) {
    const grade = byNisn.get(student.nisn) || byName.get(student.name.toLowerCase());
    if (!grade) continue;
    matched += 1;
    const excelRow = student.rowNumber;
    if (grade.nilaiRapor !== undefined || grade.rapor !== undefined) {
      model.worksheet[`G${excelRow}`] = { t: "n", v: Number(grade.nilaiRapor ?? grade.rapor) };
    }
    const tpValues = grade.tp || grade.tingkatKetercapaian || {};
    for (const tpColumn of model.tpColumns) {
      const value = tpValues[tpColumn.code];
      if (value !== undefined && value !== null && value !== "") {
        const address = XLSX.utils.encode_cell({ r: excelRow - 1, c: tpColumn.columnIndex });
        model.worksheet[address] = { t: typeof value === "number" ? "n" : "s", v: value };
      }
    }
  }

  const finalOutput = outputPath || templatePath.replace(/\.xlsx$/i, ".filled.xlsx");
  XLSX.writeFile(model.workbook, finalOutput);
  return {
    outputPath: finalOutput,
    matched,
    templateStudents: model.students.length,
    tpColumns: model.tpColumns.length,
  };
}

async function uploadTemplate(session, args, templatePath, selectedClass, selectedSubject, csrf) {
  const fields = {
    csrf_test_name: csrf,
    idrombel: selectedClass.id,
    mapel: selectedSubject.id,
    semesterke: args.semesterKe,
    semester: args.semester,
    jjg: "SD",
  };

  if (!args.apply) {
    return { dryRun: true, endpoint: "/upload_nilairapor", fields: Object.keys(fields), file: templatePath };
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value);
  }
  const bytes = fs.readFileSync(templatePath);
  form.append(
    "userfile",
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    path.basename(templatePath),
  );
  const result = await session.request("/upload_nilairapor", {
    method: "POST",
    headers: { "x-requested-with": "XMLHttpRequest" },
    body: form,
  });
  return { dryRun: false, status: result.response.status, body: result.text().slice(0, 1000) };
}

function probeDatabase() {
  const encPath = "C:/newappraporsd2025/wwwroot/.encapp";
  const psqlPath = "C:/newappraporsd2025/pgsql/bin/psql.exe";
  if (!fs.existsSync(psqlPath)) {
    return { available: false, reason: "psql.exe not found" };
  }
  let user = process.env.ERAPOR_DB_USER || "postgres";
  let password = process.env.ERAPOR_DB_PASSWORD || "";
  const port = process.env.ERAPOR_DB_PORT || "55577";
  if (!password && fs.existsSync(encPath)) {
    const enc = loadDotEnv(encPath);
    user = enc.U_USER || user;
    password = enc.U_PASS || "";
  }
  if (!password) {
    return {
      available: false,
      reason: "No E-Rapor database password available in ERAPOR_DB_PASSWORD or .encapp",
    };
  }
  const result = spawnSync(
    psqlPath,
    ["-h", "localhost", "-p", port, "-U", user, "-d", "postgres", "-Atc", "select 1"],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: password },
    },
  );
  if (result.status !== 0) {
    return {
      available: false,
      reason: "PostgreSQL password was found but authentication/query failed",
      stderr: result.stderr
        .replace(/password=[^\s]+/gi, "password=[REDACTED]")
        .trim()
        .slice(0, 500),
    };
  }
  return { available: true, result: result.stdout.trim() };
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadDotEnv();
  const session = new EraporSession(args.baseUrl);
  const summary = {
    mode: args.apply ? "apply" : "dry-run",
    baseUrl: normalizeBaseUrl(args.baseUrl),
    phases: {},
  };
  const shouldRun = (phase) => args.phase === "all" || args.phase === phase;

  let discovery = null;
  if (shouldRun("1") || shouldRun("2")) {
    const loginResult = await login(session, env, args);
    summary.login = {
      ok: true,
      school: loginResult.school.label,
      semester: loginResult.semester.label,
    };

    discovery = await discover(session, args);
    summary.discovery = {
      classCount: discovery.classes.length,
      subjectCount: discovery.subjects.length,
      selectedClass: discovery.selectedClass,
      selectedSubject: discovery.selectedSubject,
    };
  }

  let templatePath = "";
  let csrf = "";

  if (shouldRun("1") || shouldRun("2")) {
    if (!discovery) throw new Error("Discovery did not run.");
    const template = await downloadTemplate(
      session,
      args,
      discovery.selectedClass,
      discovery.selectedSubject,
    );
    templatePath = template.localPath;
    csrf = template.csrf;
    const model = inspectTemplate(templatePath);
    summary.phases.phase1 = {
      ok: true,
      templatePath,
      title: model.title,
      studentCount: model.students.length,
      tpColumnCount: model.tpColumns.length,
      firstStudents: model.students.slice(0, 3),
      tpColumns: model.tpColumns.slice(0, 5),
    };
    const grades = loadGrades(args.gradesPath);
    if (grades.length > 0 || args.output) {
      summary.phases.phase1.fill = fillTemplate(templatePath, grades, args.output);
      templatePath = summary.phases.phase1.fill.outputPath;
    }
  }

  if (shouldRun("2")) {
    summary.phases.phase2 = await uploadTemplate(
      session,
      args,
      templatePath,
      discovery.selectedClass,
      discovery.selectedSubject,
      csrf,
    );
  }

  if (shouldRun("3")) {
    summary.phases.phase3 = probeDatabase();
  }

  printSummary(summary);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
