/**
 * Format number utility for consistent display across the app
 * - Integers display without decimals: 90 → "90"
 * - Decimals preserve user input precision: 95.5 → "95.5" or "95,5"
 */

/**
 * Format a number value for display
 * @param value - The number to format
 * @param useLocale - Whether to use Indonesian locale (default: true)
 * @returns Formatted string
 */
export function formatGradeValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  
  // Check if the value is an integer (no decimal part)
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // For decimals, preserve precision without unnecessary trailing zeros
  // Convert to string to check decimal places
  const strValue = value.toString();
  
  // If already has decimal in string form, use it
  if (strValue.includes('.')) {
    // Remove unnecessary trailing zeros but keep at least one decimal if present
    const formatted = parseFloat(strValue).toString();
    return formatted;
  }
  
  return value.toString();
}

/**
 * Format number for export (Excel/PDF)
 * Integers stay as integers, decimals use 1 decimal place max
 */
export function formatForExport(value: number | null | undefined): string | number {
  if (value === null || value === undefined) return "";
  
  if (Number.isInteger(value)) {
    return value; // Return as number for Excel
  }
  
  // For decimals, preserve the actual value
  return value;
}

/**
 * Parse user input to number, handling both comma and dot as decimal separator
 */
export function parseGradeInput(input: string): number | null {
  if (!input || input.trim() === "") return null;
  
  // Replace comma with dot for parsing
  const normalized = input.replace(",", ".");
  const parsed = parseFloat(normalized);
  
  if (isNaN(parsed)) return null;
  
  // Clamp to valid grade range
  return Math.min(100, Math.max(0, parsed));
}
