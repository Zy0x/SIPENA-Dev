export interface SubjectBatchCandidate {
  id: string;
  name: string;
  kkm: number;
  isCustom: boolean;
}

export type SubjectBatchStatus = "ready" | "existing" | "duplicate_source" | "invalid";

export interface PlannedSubjectBatchCandidate extends SubjectBatchCandidate {
  normalizedName: string;
  status: SubjectBatchStatus;
}

export function normalizeSubjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function isValidSubjectKkm(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export function buildSubjectBatchPlan(
  candidates: SubjectBatchCandidate[],
  existingNames: Iterable<string>,
): PlannedSubjectBatchCandidate[] {
  const existing = new Set(Array.from(existingNames, normalizeSubjectName));
  const encountered = new Set<string>();

  return candidates.map((candidate) => {
    const name = candidate.name.trim().replace(/\s+/g, " ");
    const normalizedName = normalizeSubjectName(name);
    let status: SubjectBatchStatus = "ready";

    if (!normalizedName || !isValidSubjectKkm(candidate.kkm)) {
      status = "invalid";
    } else if (existing.has(normalizedName)) {
      status = "existing";
    } else if (encountered.has(normalizedName)) {
      status = "duplicate_source";
    }

    encountered.add(normalizedName);
    return { ...candidate, name, normalizedName, status };
  });
}

export function getReadySubjectCandidates(plan: PlannedSubjectBatchCandidate[]): PlannedSubjectBatchCandidate[] {
  return plan.filter((candidate) => candidate.status === "ready");
}
