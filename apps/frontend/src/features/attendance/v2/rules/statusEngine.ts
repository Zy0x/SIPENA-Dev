import type { AttendanceStatusDefinitionV2 } from "./ruleEngine.types";

const defaultStatuses: Record<string, AttendanceStatusDefinitionV2> = {
  H: {
    code: "H",
    label: "Hadir",
    weight: 1,
    countsAsPresent: true,
    countsAsAbsence: false,
    exportCode: "H",
    colorToken: "green",
    behaviorFlags: ["COUNTS_AS_PRESENT"],
  },
  I: {
    code: "I",
    label: "Izin",
    weight: 0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "I",
    colorToken: "blue",
    behaviorFlags: ["REQUIRES_NOTE", "COUNTS_AS_ABSENCE"],
  },
  S: {
    code: "S",
    label: "Sakit",
    weight: 0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "S",
    colorToken: "orange",
    behaviorFlags: ["REQUIRES_NOTE", "COUNTS_AS_ABSENCE"],
  },
  A: {
    code: "A",
    label: "Alpha",
    weight: 0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "A",
    colorToken: "red",
    behaviorFlags: ["COUNTS_AS_ABSENCE"],
  },
  D: {
    code: "D",
    label: "Dispensasi",
    weight: 1,
    countsAsPresent: true,
    countsAsAbsence: false,
    exportCode: "D",
    colorToken: "purple",
    behaviorFlags: ["REQUIRES_NOTE", "COUNTS_AS_PRESENT"],
  },
  L: {
    code: "L",
    label: "Libur",
    weight: 0,
    countsAsPresent: false,
    countsAsAbsence: false,
    exportCode: "L",
    colorToken: "gray",
    behaviorFlags: ["READ_ONLY"],
  },
  "-": {
    code: "-",
    label: "Belum Diisi",
    weight: 0,
    countsAsPresent: false,
    countsAsAbsence: false,
    exportCode: "-",
    colorToken: "gray",
    behaviorFlags: [],
  },
};

let activeStatuses: Record<string, AttendanceStatusDefinitionV2> = { ...defaultStatuses };

export function validateStatusDefinition(definition: AttendanceStatusDefinitionV2): string[] {
  const issues: string[] = [];

  if (!definition.code || !String(definition.code).trim()) {
    issues.push("STATUS_CODE_REQUIRED");
  }

  if (!definition.label || !definition.label.trim()) {
    issues.push("STATUS_LABEL_REQUIRED");
  }

  if (!Number.isFinite(definition.weight) || definition.weight < 0) {
    issues.push("STATUS_WEIGHT_INVALID");
  }

  if (!definition.exportCode || !definition.exportCode.trim()) {
    issues.push("STATUS_EXPORT_CODE_REQUIRED");
  }

  if (!definition.colorToken || !definition.colorToken.trim()) {
    issues.push("STATUS_COLOR_TOKEN_REQUIRED");
  }

  if (definition.countsAsPresent && definition.countsAsAbsence) {
    issues.push("STATUS_CANNOT_COUNT_AS_PRESENT_AND_ABSENCE");
  }

  return issues;
}

export function getStatusDefinition(code: string): AttendanceStatusDefinitionV2 | undefined {
  return activeStatuses[code];
}

export function registerCustomStatus(definition: AttendanceStatusDefinitionV2): void {
  const issues = validateStatusDefinition(definition);
  if (issues.length > 0) {
    throw new Error(`Invalid attendance status '${String(definition.code)}': ${issues.join(", ")}`);
  }
  activeStatuses[definition.code] = { ...definition, behaviorFlags: [...definition.behaviorFlags] };
}

export function listAllStatuses(): AttendanceStatusDefinitionV2[] {
  return Object.values(activeStatuses).map((definition) => ({
    ...definition,
    behaviorFlags: [...definition.behaviorFlags],
  }));
}

export function resetToDefaults(): void {
  activeStatuses = Object.fromEntries(
    Object.entries(defaultStatuses).map(([code, definition]) => [
      code,
      { ...definition, behaviorFlags: [...definition.behaviorFlags] },
    ])
  );
}

export function countsAsPresent(code: string): boolean {
  return !!activeStatuses[code]?.countsAsPresent;
}

export function countsAsAbsence(code: string): boolean {
  return !!activeStatuses[code]?.countsAsAbsence;
}

export function requiresNote(code: string): boolean {
  return !!activeStatuses[code]?.behaviorFlags.includes("REQUIRES_NOTE");
}
