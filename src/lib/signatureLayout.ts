export type SignatureLinePositionLike = "above-name" | "between-name-and-nip";

const SIGNATURE_NAME_LINE_GAP_MM = 0.3;
const SIGNATURE_LINE_NIP_GAP_MM = 0.35;
const SIGNATURE_NAME_NIP_GAP_MM = 0.7;
const SIGNATURE_ABOVE_NAME_GAP_MM = 1;

export interface SignatureLineSpacing {
  linePosition: SignatureLinePositionLike;
  aboveNameLineGapMm: number;
  nameToLineGapMm: number;
  lineToNipGapMm: number;
  nameToNipGapMm: number;
}

export function resolveSignatureLinePositionLike(
  value?: SignatureLinePositionLike | null,
): SignatureLinePositionLike {
  return value === "between-name-and-nip" ? "between-name-and-nip" : "above-name";
}

export function getSignatureLineSpacing(
  value?: SignatureLinePositionLike | null,
): SignatureLineSpacing {
  return {
    linePosition: resolveSignatureLinePositionLike(value),
    aboveNameLineGapMm: SIGNATURE_ABOVE_NAME_GAP_MM,
    nameToLineGapMm: SIGNATURE_NAME_LINE_GAP_MM,
    lineToNipGapMm: SIGNATURE_LINE_NIP_GAP_MM,
    nameToNipGapMm: SIGNATURE_NAME_NIP_GAP_MM,
  };
}
