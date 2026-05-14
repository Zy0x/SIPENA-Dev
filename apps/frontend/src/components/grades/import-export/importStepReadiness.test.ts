import { describe, expect, it } from "vitest";

import { getImportStepReadiness } from "./importStepReadiness";

const base = {
  stepCount: 7,
  hasPlan: true,
  unsupported: false,
  regionSelectionPending: false,
  activeImportIssueCount: 0,
  activeHeaderIssueCount: 0,
};

describe("getImportStepReadiness", () => {
  it("blocks Daftar Bermasalah until active row or cell issues are done", () => {
    expect(getImportStepReadiness({ ...base, stepIndex: 2, activeImportIssueCount: 1 })).toBe(false);
    expect(getImportStepReadiness({ ...base, stepIndex: 2, activeImportIssueCount: 0 })).toBe(true);
  });

  it("blocks Konfigurasi Header until active header issues are done", () => {
    expect(getImportStepReadiness({ ...base, stepIndex: 3, activeHeaderIssueCount: 1 })).toBe(false);
    expect(getImportStepReadiness({ ...base, stepIndex: 3, activeHeaderIssueCount: 0 })).toBe(true);
  });

  it("lets Verifikasi Tabel and Review Akhir continue from active issue queues instead of stale plan summaries", () => {
    expect(getImportStepReadiness({ ...base, stepIndex: 4 })).toBe(true);
    expect(getImportStepReadiness({ ...base, stepIndex: 5 })).toBe(true);
    expect(getImportStepReadiness({ ...base, stepIndex: 4, activeHeaderIssueCount: 1 })).toBe(false);
  });

  it("does not advance from the final Simpan step", () => {
    expect(getImportStepReadiness({ ...base, stepIndex: 6 })).toBe(false);
  });
});
