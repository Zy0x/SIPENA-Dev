/**
 * pdfFontLoader.ts
 *
 * Loads Plus Jakarta Sans (Regular + Bold) from Google Fonts once per session,
 * caches it in memory, and registers it with jsPDF so all PDF exports share
 * the same clean, modern typeface.
 *
 * Falls back to "helvetica" automatically if the fetch fails (e.g. offline).
 *
 * Usage:
 *   const F = await loadPdfFont();
 *   doc.setFont(F.family, F.normal);   // Regular
 *   doc.setFont(F.family, F.bold);     // Bold
 */

import type jsPDF from "jspdf";

export interface PdfFont {
  /** Font family name registered in jsPDF, e.g. "PlusJakartaSans" */
  family: string;
  /** Style string for normal weight, e.g. "normal" */
  normal: string;
  /** Style string for bold weight, e.g. "bold" */
  bold: string;
  /** Whether the custom font is loaded (false ⟹ using helvetica fallback) */
  loaded: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────
const FAMILY = "PlusJakartaSans";
const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700&display=swap&subset=latin";

// ── In-memory cache (survives navigation within the same tab) ───────────────
let _fontCache: PdfFont | null = null;
let _loadPromise: Promise<PdfFont> | null = null;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse the first woff2 src URL for the given weight from a @font-face CSS text. */
function extractWoff2Url(css: string, weight: "400" | "700"): string | null {
  // Match @font-face blocks that contain font-weight: <weight>
  const blocks = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
  for (const block of blocks) {
    if (!block.includes(`font-weight: ${weight}`) && !block.includes(`font-weight:${weight}`)) continue;
    const m = block.match(/url\(([^)]+\.woff2[^)]*)\)/);
    if (m) return m[1].replace(/['"]/g, "");
  }
  return null;
}

/** Fetch a binary resource and return it as a base64 string. */
async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buffer = await res.arrayBuffer();
  // Convert ArrayBuffer → base64 in browser
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Register a single font variant into the jsPDF doc's VFS. */
function registerFont(doc: jsPDF, fileName: string, base64Data: string, style: string) {
  try {
    doc.addFileToVFS(fileName, base64Data);
    doc.addFont(fileName, FAMILY, style);
  } catch (err) {
    console.warn(`[pdfFontLoader] registerFont(${fileName}) failed:`, err);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a PdfFont descriptor after loading and registering Plus Jakarta Sans.
 * Subsequent calls return the cached descriptor instantly.
 *
 * @param doc  A jsPDF instance to register the font into. Only the FIRST call
 *             actually registers; subsequent callers share the same VFS data.
 */
export async function loadPdfFont(doc: jsPDF): Promise<PdfFont> {
  // Cache hit
  if (_fontCache) {
    // Re-register into this specific doc instance (each new jsPDF() has empty VFS)
    if (_fontCache.loaded && (_fontRegularB64 || _fontBoldB64)) {
      if (_fontRegularB64) registerFont(doc, "PlusJakartaSans-Regular.ttf", _fontRegularB64, "normal");
      if (_fontBoldB64)    registerFont(doc, "PlusJakartaSans-Bold.ttf",    _fontBoldB64,    "bold");
    }
    return _fontCache;
  }

  // Already loading — wait for it
  if (_loadPromise) {
    await _loadPromise;
    return loadPdfFont(doc); // tail call with cache populated
  }

  _loadPromise = _doLoad(doc);
  const result = await _loadPromise;
  _fontCache = result;
  return result;
}

// Store base64 blobs so we can re-register into fresh jsPDF instances
let _fontRegularB64: string | null = null;
let _fontBoldB64:    string | null = null;

async function _doLoad(doc: jsPDF): Promise<PdfFont> {
  const fallback: PdfFont = { family: "helvetica", normal: "normal", bold: "bold", loaded: false };

  try {
    // 1. Fetch Google Fonts CSS to extract woff2 URLs (respects unicode-range)
    const cssRes = await fetch(GOOGLE_FONTS_CSS, {
      headers: { Accept: "text/css,*/*;q=0.1" },
      cache: "force-cache",
    });
    if (!cssRes.ok) return fallback;
    const css = await cssRes.text();

    const regularUrl = extractWoff2Url(css, "400");
    const boldUrl    = extractWoff2Url(css, "700");
    if (!regularUrl) return fallback;

    // 2. Fetch font binaries in parallel
    const [regularB64, boldB64] = await Promise.all([
      fetchBase64(regularUrl),
      boldUrl ? fetchBase64(boldUrl) : Promise.resolve(null),
    ]);

    // 3. Register into this jsPDF instance's VFS
    _fontRegularB64 = regularB64;
    _fontBoldB64    = boldB64;

    registerFont(doc, "PlusJakartaSans-Regular.ttf", regularB64, "normal");
    if (boldB64) registerFont(doc, "PlusJakartaSans-Bold.ttf", boldB64, "bold");

    return {
      family: FAMILY,
      normal: "normal",
      bold:   boldB64 ? "bold" : "normal",
      loaded: true,
    };
  } catch (err) {
    console.warn("[pdfFontLoader] Failed to load Plus Jakarta Sans, falling back to helvetica:", err);
    return fallback;
  }
}

/**
 * Convenience: set the current font in a doc using a PdfFont descriptor.
 * @example
 *   setDocFont(doc, F, "bold");
 */
export function setDocFont(doc: jsPDF, font: PdfFont, style: "normal" | "bold" = "normal") {
  try {
    doc.setFont(font.family, style === "bold" ? font.bold : font.normal);
  } catch {
    doc.setFont("helvetica", style);
  }
}
