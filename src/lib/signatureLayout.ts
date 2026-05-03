export type SignatureLinePositionLike = "above-name" | "between-name-and-nip";
export type SignatureLineLengthModeLike = "fixed" | "name" | "nip";

const SIGNATURE_NAME_NIP_GAP_MM = 0.45;
const SIGNATURE_ABOVE_NAME_GAP_MM = 0.8;
const SIGNATURE_NAME_NIP_LINE_ZONE_MM = 2.1;

export interface SignatureLineSpacing {
  linePosition: SignatureLinePositionLike;
  aboveNameLineGapMm: number;
  nameToLineGapMm: number;
  lineToNipGapMm: number;
  nameToNipGapMm: number;
  betweenNameAndNipZoneMm: number;
  betweenNameAndNipBaselineGapMm: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveSignatureLineLengthModeLike(
  value?: SignatureLineLengthModeLike | null,
): SignatureLineLengthModeLike {
  return value === "name" || value === "nip" ? value : "fixed";
}

export function estimateSignatureTextWidthMm(
  text: string,
  fontSizePt: number,
  weight: "normal" | "bold" = "normal",
) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return 0;
  const weightFactor = weight === "bold" ? 1.05 : 1;
  return Math.max(16, normalized.length * fontSizePt * 0.19 * weightFactor + 4.2);
}

export function resolveSignatureLineWidthMm(args: {
  lineLengthMode?: SignatureLineLengthModeLike | null;
  fixedWidthMm?: number | null;
  name?: string | null;
  nip?: string | null;
  fontSizePt?: number | null;
}) {
  const mode = resolveSignatureLineLengthModeLike(args.lineLengthMode);
  const fontSizePt = Math.max(8, Math.min(14, args.fontSizePt || 10));
  const fixedWidthMm = clamp(Number(args.fixedWidthMm || 50), 24, 110);
  const trimmedName = args.name?.trim() || "";
  const trimmedNip = args.nip?.trim() || "";

  if (mode === "name" && trimmedName) {
    return clamp(Number(estimateSignatureTextWidthMm(trimmedName, fontSizePt, "bold").toFixed(2)), 24, 110);
  }

  if (mode === "nip" && trimmedNip) {
    const nipText = `NIP. ${trimmedNip}`;
    return clamp(Number(estimateSignatureTextWidthMm(nipText, Math.max(8, fontSizePt - 1), "normal").toFixed(2)), 24, 110);
  }

  return fixedWidthMm;
}

export function resolveSignatureSignerBlockWidthMm(args: {
  lineLengthMode?: SignatureLineLengthModeLike | null;
  fixedWidthMm?: number | null;
  name?: string | null;
  nip?: string | null;
  fontSizePt?: number | null;
}) {
  const lineWidthMm = resolveSignatureLineWidthMm(args);
  return clamp(Number((lineWidthMm + 10).toFixed(2)), 32, 120);
}

export function resolveSignatureLinePositionLike(
  value?: SignatureLinePositionLike | null,
): SignatureLinePositionLike {
  return value === "between-name-and-nip" ? "between-name-and-nip" : "above-name";
}

export function getSignatureLineSpacing(
  value?: SignatureLinePositionLike | null,
  fontSizePt?: number | null,
): SignatureLineSpacing {
  const fontSize = clamp(Number(fontSizePt || 10), 8, 14);
  const fontSizeMm = fontSize * 0.3528;
  const betweenNameAndNipBaselineGapMm = clamp(Number((fontSizeMm * 1.75).toFixed(2)), 5.8, 8.2);
  const nameToLineGapMm = clamp(Number((fontSizeMm * 0.62).toFixed(2)), 2.05, 3.25);
  const lineToNipGapMm = Number(Math.max(2.4, betweenNameAndNipBaselineGapMm - nameToLineGapMm).toFixed(2));

  return {
    linePosition: resolveSignatureLinePositionLike(value),
    aboveNameLineGapMm: SIGNATURE_ABOVE_NAME_GAP_MM,
    nameToLineGapMm,
    lineToNipGapMm,
    nameToNipGapMm: SIGNATURE_NAME_NIP_GAP_MM,
    betweenNameAndNipZoneMm: Math.max(SIGNATURE_NAME_NIP_LINE_ZONE_MM, Number((betweenNameAndNipBaselineGapMm - 2.4).toFixed(2))),
    betweenNameAndNipBaselineGapMm,
  };
}
