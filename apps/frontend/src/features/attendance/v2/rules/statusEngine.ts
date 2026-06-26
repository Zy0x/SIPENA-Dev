import { AttendanceStatusDefinitionV2 } from "./ruleEngine.types";

const defaultStatuses: Record<string, AttendanceStatusDefinitionV2> = {
  H: {
    code: "H",
    label: "Hadir",
    weight: 1.0,
    countsAsPresent: true,
    countsAsAbsence: false,
    exportCode: "H",
    colorToken: "green",
    behaviorFlags: [],
  },
  I: {
    code: "I",
    label: "Izin",
    weight: 0.0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "I",
    colorToken: "blue",
    behaviorFlags: ["REQUIRES_NOTE"],
  },
  S: {
    code: "S",
    label: "Sakit",
    weight: 0.0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "S",
    colorToken: "orange",
    behaviorFlags: ["REQUIRES_NOTE"],
  },
  A: {
    code: "A",
    label: "Alpha",
    weight: 0.0,
    countsAsPresent: false,
    countsAsAbsence: true,
    exportCode: "A",
    colorToken: "red",
    behaviorFlags: [],
  },
  D: {
    code: "D",
    label: "Dispensasi",
    weight: 1.0,
    countsAsPresent: true,
    countsAsAbsence: false,
    exportCode: "D",
    colorToken: "purple",
    behaviorFlags: ["REQUIRES_NOTE"],
  },
  L: {
    code: "L",
    label: "Libur",
    weight: 0.0,
    countsAsPresent: false,
    countsAsAbsence: false,
    exportCode: "L",
    colorToken: "gray",
    behaviorFlags: ["READ_ONLY"],
  },
  "-": {
    code: "-",
    label: "Belum Diisi",
    weight: 0.0,
    countsAsPresent: false,
    countsAsAbsence: false,
    exportCode: "-",
    colorToken: "gray",
    behaviorFlags: [],
  },
};

let activeStatuses: Record<string, AttendanceStatusDefinitionV2> = { ...defaultStatuses };

/**
 * getStatusDefinition
 * Retrieves the status config for a specific status code.
 */
export function getStatusDefinition(code: string): AttendanceStatusDefinitionV2 | undefined {
  return activeStatuses[code];
}

/**
 * registerCustomStatus
 * Dynamically registers a custom attendance status for the school.
 */
export function registerCustomStatus(definition: AttendanceStatusDefinitionV2): void {
  activeStatuses[definition.code] = definition;
}

/**
 * listAllStatuses
 * Returns all active status configurations.
 */
export function listAllStatuses(): AttendanceStatusDefinitionV2[] {
  return Object.values(activeStatuses);
}

/**
 * resetToDefaults
 * Resets status definitions to the V1 defaults.
 */
export function resetToDefaults(): void {
  activeStatuses = { ...defaultStatuses };
}

/**
 * countsAsPresent
 * Returns if a status counts towards presence.
 */
export function countsAsPresent(code: string): boolean {
  return !!activeStatuses[code]?.countsAsPresent;
}

/**
 * countsAsAbsence
 * Returns if a status counts towards absence.
 */
export function countsAsAbsence(code: string): boolean {
  return !!activeStatuses[code]?.countsAsAbsence;
}

/**
 * requiresNote
 * Checks if a status requires a descriptive note.
 */
export function requiresNote(code: string): boolean {
  return !!activeStatuses[code]?.behaviorFlags.includes("REQUIRES_NOTE");
}
