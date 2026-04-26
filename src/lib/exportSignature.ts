/**
 * Export Signature Block utilities
 * Adds official signature blocks to PDF, Excel, CSV, dan PNG
 */
import jsPDF from "jspdf";
import { getSignatureLineSpacing, resolveSignatureLinePositionLike } from "@/lib/signatureLayout";

export interface SignatureSigner {
  id?: string;
  name: string;
  title: string;
  nip?: string;
  school_name?: string;
  order_index?: number;
}

export type SignatureAlignment = 'left' | 'center' | 'right';
export type SignaturePlacementMode = 'adaptive' | 'flow' | 'fixed';
export type SignaturePreset = 'follow-content' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type SignatureLinePosition = 'above-name' | 'between-name-and-nip';

export interface SignatureData {
  city: string;
  signers?: SignatureSigner[];
  useCustomDate?: boolean;
  customDate?: string | null;
  fontSize?: number;
  showSignatureLine?: boolean;
  signatureLinePosition?: SignatureLinePosition;
  signatureLineWidth?: number;
  signatureSpacing?: number;
  signatureAlignment?: SignatureAlignment;
  signatureOffsetX?: number; // mm
  signatureOffsetY?: number; // mm
  placementMode?: SignaturePlacementMode;
  signaturePreset?: SignaturePreset;
  manualXPercent?: number | null;
  manualYPercent?: number | null;
  snapToGrid?: boolean;
  gridSizeMm?: number;
  lockSignaturePosition?: boolean;
  showDebugGuides?: boolean;
  /** Optional explicit page index (0-based) to place signature on. */
  signaturePageIndex?: number | null;
  name?: string;
  title?: string;
  nip?: string;
  school_name?: string;
}

function formatDateIndonesian(date?: string | null): string {
  const selectedDate = date ? new Date(date) : new Date();
  return selectedDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getSigners(signature: SignatureData): SignatureSigner[] {
  if (Array.isArray(signature.signers) && signature.signers.length > 0) {
    return [...signature.signers]
      .filter((s) => s && (s.name?.trim() || s.title?.trim()))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }
  return [{
    name: signature.name || "",
    title: signature.title || "Guru Mata Pelajaran",
    nip: signature.nip,
    school_name: signature.school_name,
  }];
}

function getSignatureDate(signature: SignatureData): string {
  return formatDateIndonesian(signature.useCustomDate ? signature.customDate : undefined);
}

function estimateTextWidthMm(text: string, fontSize: number, weight: "normal" | "bold" = "normal") {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return 0;
  const weightFactor = weight === "bold" ? 1.06 : 1;
  return Math.max(18, normalized.length * fontSize * 0.19 * weightFactor + 6);
}

function getSignatureLinePosition(signature: SignatureData): SignatureLinePosition {
  return resolveSignatureLinePositionLike(signature.signatureLinePosition);
}

export function getPreferredSignerBlockWidth(signature: SignatureData) {
  return Math.max(54, (signature.signatureLineWidth || 50) + 10);
}

export function estimateSignatureDateLineWidthMm(signature: SignatureData) {
  const fontSize = Math.max(8, Math.min(14, signature.fontSize || 10)) + 1;
  return estimateTextWidthMm(`${signature.city || "[Kota]"}, ${getSignatureDate(signature)}`, fontSize, "normal");
}

export function estimateSignatureBlockWidthMm(signature: SignatureData) {
  const signers = getSigners(signature);
  const spacingMm = signature.signatureSpacing || 20;
  const signerWidth = signers.length * getPreferredSignerBlockWidth(signature) + Math.max(0, signers.length - 1) * spacingMm;
  return Math.max(signerWidth, estimateSignatureDateLineWidthMm(signature));
}

/**
 * Hitung tinggi blok tanda tangan dalam mm
 */
export function computeSignatureHeight(signature: SignatureData): number {
  const signers = getSigners(signature);
  const hasSchool = signers.some((s, i) => i === 0 && s.school_name);
  const hasNip = signers.some(s => s.nip);
  const spacing = getSignatureLineSpacing(getSignatureLinePosition(signature));
  const lineGapMm = signature.showSignatureLine === false
    ? (hasNip ? spacing.nameToNipGapMm : 0)
    : getSignatureLinePosition(signature) === "between-name-and-nip" && hasNip
      ? spacing.nameToLineGapMm + spacing.lineToNipGapMm
      : 0;
  // date line (6) + title (4) + school_name (4?) + spacing untuk TTD (18) + name (5) + optional line gap + nip (4?)
  return 6 + 4 + (hasSchool ? 4 : 0) + 18 + 5 + lineGapMm + (hasNip ? 4 : 0);
}

export function resolveSignatureRenderBoxMm(args: {
  signature: SignatureData;
  pageWidthMm: number;
  placement?: {
    xMm: number;
    yMm: number;
    widthMm: number;
  } | null;
}) {
  const { signature, pageWidthMm, placement } = args;
  const signers = getSigners(signature);
  const signerCount = Math.max(1, signers.length);
  const hasNip = signers.some((signer) => signer.nip);
  const spacingMm = signature.signatureSpacing || 20;
  const alignment = signature.signatureAlignment || "right";
  const offsetX = signature.signatureOffsetX || 0;
  const margin = 14;
  const availableWidth = pageWidthMm - margin * 2;
  const placementWidth = placement?.widthMm;
  const preferredBlockW = getPreferredSignerBlockWidth(signature);
  const maxBlockW = placementWidth
    ? Math.min(preferredBlockW, Math.max(42, (placementWidth - (signerCount - 1) * spacingMm) / signerCount))
    : Math.min(preferredBlockW, (availableWidth - (signerCount - 1) * spacingMm) / signerCount);
  const signerWidth = signerCount * maxBlockW + (signerCount - 1) * spacingMm;
  const totalWidth = Math.max(signerWidth, estimateSignatureDateLineWidthMm(signature));

  let startX: number;
  if (typeof placement?.xMm === "number") {
    if (alignment === "left") {
      startX = placement.xMm;
    } else if (alignment === "center") {
      startX = placement.xMm + (placement.widthMm - totalWidth) / 2;
    } else {
      startX = placement.xMm + placement.widthMm - totalWidth;
    }
  } else if (alignment === "left") {
    startX = margin + offsetX;
  } else if (alignment === "center") {
    startX = (pageWidthMm - totalWidth) / 2 + offsetX;
  } else {
    startX = pageWidthMm - margin - totalWidth + offsetX;
  }

  startX = Math.max(margin, Math.min(Math.max(margin, pageWidthMm - margin - totalWidth), startX));

  // PDF text is positioned by baseline, so the visual content starts a few mm
  // above placement.yMm. Expand the helper box upward/downward so the border
  // matches the actually visible signature block, including city/date text.
  const fontSizeMm = Math.max(8, Math.min(14, signature.fontSize || 10)) * 0.3528;
  const topVisualInsetMm = Math.max(3.6, Math.min(5, fontSizeMm + 0.9));
  const bottomVisualInsetMm = hasNip ? 2.4 : 1.8;

  return {
    xMm: startX,
    yMm: Math.max(0, (placement?.yMm ?? 0) - topVisualInsetMm),
    widthMm: totalWidth,
    heightMm: computeSignatureHeight(signature) + topVisualInsetMm + bottomVisualInsetMm,
  };
}

/**
 * Add signature block to PDF — side by side, handles page breaks SMART.
 * 
 * Strategi penempatan:
 * 1. Coba letakkan tepat setelah konten (gap 3mm saja)
 * 2. Jika tidak muat, pindah halaman baru DAN posisikan di atas (bukan bawah)
 *    agar tidak ada ruang kosong besar di atas TTD
 */
export function addSignatureBlockPDF(
  doc: jsPDF,
  signature: SignatureData,
  startY: number,
  placement?: {
    xMm: number;
    yMm: number;
    widthMm: number;
  } | null,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = getSignatureDate(signature);
  const fontSize = Math.max(8, Math.min(14, signature.fontSize || 10));
  const signers = getSigners(signature);
  const showLine = signature.showSignatureLine !== false;
  const linePosition = getSignatureLinePosition(signature);
  const lineSpacing = getSignatureLineSpacing(linePosition);
  const lineWidthMm = signature.signatureLineWidth || 50;
  const spacingMm = signature.signatureSpacing || 20;
  const alignment = signature.signatureAlignment || 'right';
  const dateAlign: "left" | "center" | "right" = alignment === "left"
    ? "left"
    : alignment === "center"
      ? "center"
      : "right";
  const offsetX = signature.signatureOffsetX || 0;
  const offsetY = signature.signatureOffsetY || 0;

  const sigHeight = computeSignatureHeight(signature);
  const bottomMargin = 10;

  // Gap minimal + user offset vertikal
  let y = placement?.yMm ?? (startY + 3 + offsetY);

  // Jika layout sudah memberi placement eksplisit, hormati halaman & koordinat itu.
  if (!placement && y + sigHeight > pageHeight - bottomMargin) {
    doc.addPage();
    y = 15 + Math.max(0, offsetY);
  }

  // Clamp Y agar tidak di luar batas
  y = Math.max(10, Math.min(pageHeight - bottomMargin - sigHeight, y));

  const margin = 14;
  const renderBox = resolveSignatureRenderBoxMm({ signature, pageWidthMm: pageWidth, placement });
  const signerCount = signers.length;
  const maxBlockW = (renderBox.widthMm - (signerCount - 1) * spacingMm) / signerCount;
  const totalWidth = renderBox.widthMm;
  const startX = renderBox.xMm;

  // Date line — aligned with block
  const dateX = typeof placement?.xMm === "number"
    ? alignment === "left"
      ? placement.xMm
      : alignment === "center"
        ? placement.xMm + placement.widthMm / 2
        : placement.xMm + placement.widthMm
    : alignment === 'left'
      ? startX
      : alignment === 'center'
        ? pageWidth / 2 + offsetX
        : pageWidth - margin + offsetX;
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(`${signature.city}, ${dateStr}`, Math.max(margin, Math.min(pageWidth - margin, dateX)), y, {
    align: dateAlign,
  });
  y += 5.2;

  signers.forEach((signer, index) => {
    const x = startX + index * (maxBlockW + spacingMm);
    const centerX = x + maxBlockW / 2;
    const yBase = y;

    // Title — centered in block
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(signer.title || "Guru Mata Pelajaran", centerX, yBase, { align: "center" });

    let extraOffset = 0;
    if (index === 0 && signer.school_name) {
      doc.setFontSize(Math.max(8, fontSize - 1));
      doc.text(signer.school_name, centerX, yBase + 4, { align: "center" });
      extraOffset = 4;
    }

    const signLineY = yBase + 17 + extraOffset;
    const nameY = linePosition === "between-name-and-nip"
      ? signLineY
      : signLineY + 3.2 + lineSpacing.aboveNameLineGapMm;

    if (showLine && linePosition === "above-name") {
      const halfLine = Math.max(lineWidthMm, 42) / 2;
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.3);
      doc.line(centerX - halfLine, signLineY, centerX + halfLine, signLineY);
    }

    // Name — bold, centered
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(signer.name || "", centerX, nameY, { align: "center" });

    if (showLine && linePosition === "between-name-and-nip") {
      const halfLine = Math.max(lineWidthMm, 42) / 2;
      const lineY = signer.nip
        ? nameY + (lineSpacing.betweenNameAndNipBaselineGapMm / 2)
        : nameY + 2.4 + lineSpacing.aboveNameLineGapMm;
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.3);
      doc.line(centerX - halfLine, lineY, centerX + halfLine, lineY);
    }

    if (signer.nip) {
      doc.setFontSize(Math.max(8, fontSize - 1));
      doc.setFont("helvetica", "normal");
      const nipY = showLine && linePosition === "between-name-and-nip"
        ? nameY + lineSpacing.betweenNameAndNipBaselineGapMm
        : nameY + 3.1 + lineSpacing.nameToNipGapMm;
      doc.text(`NIP. ${signer.nip}`, centerX, nipY, { align: "center" });
    }
  });
}

/**
 * Generate signature HTML block for PNG export
 * Layout: signature ditempatkan inline-flex di kanan, bisa berdampingan dengan keterangan
 */
export function generateSignatureHTML(signature: SignatureData): string {
  const dateStr = getSignatureDate(signature);
  const signers = getSigners(signature);
  const fontSize = Math.max(8, Math.min(14, signature.fontSize || 10));
  const lineWidth = signature.signatureLineWidth || 50;
  const spacing = signature.signatureSpacing || 20;
  const showLine = signature.showSignatureLine !== false;
  const linePosition = getSignatureLinePosition(signature);
  const lineSpacing = getSignatureLineSpacing(linePosition);
  const alignment = signature.signatureAlignment || 'right';
  const offsetX = signature.signatureOffsetX || 0;
  const offsetY = signature.signatureOffsetY || 0;

  const textAlign = alignment === 'left' ? 'left' : alignment === 'center' ? 'center' : 'right';
  const justifyContent = alignment === 'left' ? 'flex-start' : alignment === 'center' ? 'center' : 'flex-end';

  const sanitize = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));

  let html = `<div style="padding:${8 + offsetY}px 28px 12px;text-align:${textAlign};margin-left:${offsetX > 0 ? offsetX * 2 : 0}px;margin-right:${offsetX < 0 ? -offsetX * 2 : 0}px;">`;
  html += `<div style="font-size:${fontSize}px;margin-bottom:3px;">${sanitize(signature.city || "")}, ${dateStr}</div>`;
  html += `<div style="display:inline-flex;justify-content:${justifyContent};gap:${spacing * 1.5}px;flex-wrap:wrap;">`;

  signers.forEach((signer, idx) => {
    html += `<div style="text-align:center;min-width:${lineWidth * 2.2}px;max-width:${signers.length > 2 ? '38%' : '45%'};font-size:${fontSize}px;">`;
    html += `<div>${sanitize(signer.title || "Guru Mata Pelajaran")}</div>`;
    if (idx === 0 && signer.school_name) {
      html += `<div style="font-size:${Math.max(8, fontSize - 1)}px;color:#6b7280;">${sanitize(signer.school_name)}</div>`;
    }
    html += `<div style="height:36px;"></div>`;
    if (showLine && linePosition === "above-name") {
      html += `<div style="border-bottom:1px solid #1e293b;margin-bottom:3px;width:${lineWidth * 2}px;margin-left:auto;margin-right:auto;"></div>`;
    }
    html += `<div style="font-weight:700;line-height:1.05;">${sanitize(signer.name || "")}</div>`;
    if (showLine && linePosition === "between-name-and-nip" && signer.nip) {
      html += `<div style="position:relative;width:${lineWidth * 2}px;height:${Math.max(6, Math.round(lineSpacing.betweenNameAndNipZoneMm * 3.78))}px;margin:0 auto;"><div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);border-bottom:1px solid #1e293b;"></div></div>`;
    } else if (showLine && linePosition === "between-name-and-nip") {
      html += `<div style="border-bottom:1px solid #1e293b;margin:${Math.max(2, Math.round(lineSpacing.aboveNameLineGapMm * 3.78))}px auto 0;width:${lineWidth * 2}px;"></div>`;
    }
    if (signer.nip) {
      html += `<div style="font-size:${Math.max(8, fontSize - 1)}px;color:#6b7280;line-height:1.05;margin-top:${showLine && linePosition === "between-name-and-nip" ? 0 : Math.max(1, Math.round(lineSpacing.nameToNipGapMm * 3.78))}px;">NIP. ${sanitize(signer.nip)}</div>`;
    }
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

/**
 * Generate signature HTML yang bisa ditempatkan berdampingan (side-by-side) dengan konten lain
 * Digunakan untuk layout PNG di mana signature dan keterangan bisa berbagi baris
 */
export function generateSignatureHTMLInline(signature: SignatureData): string {
  const dateStr = getSignatureDate(signature);
  const signers = getSigners(signature);
  const fontSize = Math.max(8, Math.min(14, signature.fontSize || 10));
  const lineWidth = signature.signatureLineWidth || 50;
  const spacing = signature.signatureSpacing || 20;
  const showLine = signature.showSignatureLine !== false;
  const linePosition = getSignatureLinePosition(signature);
  const lineSpacing = getSignatureLineSpacing(linePosition);
  const alignment = signature.signatureAlignment || 'right';
  const offsetX = signature.signatureOffsetX || 0;

  const textAlign = alignment === 'left' ? 'left' : alignment === 'center' ? 'center' : 'right';

  const sanitize = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));

  let html = `<div style="text-align:${textAlign};transform:translateX(${offsetX}px);">`;
  html += `<div style="font-size:${fontSize}px;margin-bottom:3px;">${sanitize(signature.city || "")}, ${dateStr}</div>`;
  html += `<div style="display:inline-flex;gap:${spacing}px;flex-wrap:wrap;">`;

  signers.forEach((signer, idx) => {
    const blockWidth = Math.min(lineWidth * 2.2, 140);
    html += `<div style="text-align:center;min-width:${blockWidth}px;font-size:${fontSize}px;">`;
    html += `<div>${sanitize(signer.title || "Guru Mata Pelajaran")}</div>`;
    if (idx === 0 && signer.school_name) {
      html += `<div style="font-size:${Math.max(8, fontSize - 1)}px;color:#6b7280;">${sanitize(signer.school_name)}</div>`;
    }
    html += `<div style="height:36px;"></div>`;
    if (showLine && linePosition === "above-name") {
      html += `<div style="border-bottom:1px solid #1e293b;margin-bottom:3px;width:${lineWidth * 2}px;margin-left:auto;margin-right:auto;"></div>`;
    }
    html += `<div style="font-weight:700;line-height:1.05;">${sanitize(signer.name || "")}</div>`;
    if (showLine && linePosition === "between-name-and-nip" && signer.nip) {
      html += `<div style="position:relative;width:${lineWidth * 2}px;height:${Math.max(6, Math.round(lineSpacing.betweenNameAndNipZoneMm * 3.78))}px;margin:0 auto;"><div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);border-bottom:1px solid #1e293b;"></div></div>`;
    } else if (showLine && linePosition === "between-name-and-nip") {
      html += `<div style="border-bottom:1px solid #1e293b;margin:${Math.max(2, Math.round(lineSpacing.aboveNameLineGapMm * 3.78))}px auto 0;width:${lineWidth * 2}px;"></div>`;
    }
    if (signer.nip) {
      html += `<div style="font-size:${Math.max(8, fontSize - 1)}px;color:#6b7280;line-height:1.05;margin-top:${showLine && linePosition === "between-name-and-nip" ? 0 : Math.max(1, Math.round(lineSpacing.nameToNipGapMm * 3.78))}px;">NIP. ${sanitize(signer.nip)}</div>`;
    }
    html += `</div>`;
  });

  html += `</div></div>`;
  return html;
}

export function getSignatureRowsExcel(signature: SignatureData, totalColumns: number): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const dateStr = getSignatureDate(signature);
  const signers = getSigners(signature);
  const linePosition = getSignatureLinePosition(signature);

  const makeRow = (text = "") => {
    const row = new Array(totalColumns).fill("");
    row[Math.max(0, totalColumns - 1)] = text;
    return row;
  };

  // Hanya 1 baris kosong sebelum signature (bukan 2)
  rows.push(makeRow());
  rows.push(makeRow(`${signature.city}, ${dateStr}`));

  signers.forEach((signer, index) => {
    rows.push(makeRow(signer.title || "Guru Mata Pelajaran"));
    if (index === 0 && signer.school_name) rows.push(makeRow(signer.school_name));
    rows.push(makeRow(), makeRow(), makeRow());
    if (signature.showSignatureLine !== false && linePosition === "above-name") {
      rows.push(makeRow("___________________________"));
    }
    rows.push(makeRow(signer.name || ""));
    if (signature.showSignatureLine !== false && linePosition === "between-name-and-nip") {
      rows.push(makeRow("___________________________"));
    }
    if (signer.nip) rows.push(makeRow(`NIP. ${signer.nip}`));
    if (index < signers.length - 1) rows.push(makeRow());
  });

  return rows;
}

export function getSignatureRowsCSV(signature: SignatureData, totalColumns: number): string[][] {
  return getSignatureRowsExcel(signature, totalColumns).map((row) => row.map((cell) => String(cell ?? "")));
}
