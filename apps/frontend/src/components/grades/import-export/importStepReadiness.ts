export type ImportStepReadinessInput = {
  stepIndex: number;
  stepCount: number;
  hasPlan: boolean;
  unsupported: boolean;
  regionSelectionPending: boolean;
  activeImportIssueCount: number;
  activeHeaderIssueCount: number;
};

export function getImportStepReadiness({
  stepIndex,
  stepCount,
  hasPlan,
  unsupported,
  regionSelectionPending,
  activeImportIssueCount,
  activeHeaderIssueCount,
}: ImportStepReadinessInput): boolean {
  if (stepIndex >= stepCount - 1) return false;
  if (!hasPlan || unsupported || regionSelectionPending) return false;
  if (stepIndex === 2) return activeImportIssueCount === 0;
  if (stepIndex === 3) return activeImportIssueCount === 0 && activeHeaderIssueCount === 0;
  if (stepIndex === 4 || stepIndex === 5) return activeImportIssueCount === 0 && activeHeaderIssueCount === 0;
  return true;
}
