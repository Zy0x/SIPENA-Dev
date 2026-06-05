import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  analyzeFreeExcelWorkbook,
  buildExecutableImportOperations,
  buildImportPlan,
  buildSpreadsheetPreviewModel,
  matchColumns,
  matchStudents,
  parseGradeValue,
  readWorkbookBuffer,
  simplifyImportConflicts,
  type ImportPlanContext,
} from "./index";

const students = [
  { id: "student-1", name: "Siti Aminah", nisn: "0012345678" },
  { id: "student-2", name: "Muhammad Rizki", nisn: "1234567890" },
];

const chapters = [
  { id: "chapter-1", name: "BAB 1", order_index: 1 },
  { id: "chapter-2", name: "BAB 2", order_index: 2 },
];

const assignments = [
  { id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 },
  { id: "assignment-2", chapter_id: "chapter-2", name: "Tugas 1", order_index: 1 },
];

const context: ImportPlanContext = { students, chapters, assignments };

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

function workbookResult(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return readWorkbookBuffer(buffer, "phase12.xlsx");
}

describe("phase 12 grade import regression suite", () => {
  it("keeps workbook coordinates with title rows, blank rows, footers, and zero values", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["KOP SEKOLAH"],
        [],
        ["Daftar Nilai Harian"],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 0],
        [],
        [2, "1234567890", "Muhammad Rizki", 90],
        ["Jumlah", "", "", 90],
        ["Rata-rata", "", "", 45],
        ["Mengetahui", "", "", ""],
      ],
    }), { students });
    const plan = buildImportPlan(analysis, context);

    expect(analysis.bestRegion).toMatchObject({
      headerRowIndex: 4,
      dataStartRowIndex: 5,
      dataEndRowIndex: 7,
    });
    expect(analysis.bestRegion?.addressedDataRows.map((row) => row.originalRowIndex)).toEqual([5, 7]);
    expect(plan.gradeOperations.map((operation) => operation.rowIndex)).toEqual([5, 7]);
    expect(plan.gradeOperations.map((operation) => operation.value)).toEqual([0, 90]);
    expect(plan.gradeOperations.map((operation) => operation.rawValue)).not.toContain("Jumlah");
  });

  it("auto-selects a single free Excel region but requires explicit selection for multi-region workbooks", () => {
    const single = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 88],
      ],
    }), { students });
    const multi = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 99],
        [2, "1234567890", "Muhammad Rizki", 98],
        [],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 70],
      ],
    }), { students });

    expect(single.regions).toHaveLength(1);
    expect(single.requiresRegionSelection).toBe(false);
    expect(buildImportPlan(single, context).gradeOperations).toHaveLength(1);
    expect(multi.regions.length).toBeGreaterThan(1);
    expect(multi.requiresRegionSelection).toBe(true);
    expect(buildImportPlan(multi, context).conflicts.map((item) => item.code)).toContain("IMPORT_REGION_SELECTION_REQUIRED");
  });

  it("uses the selected region even when another region has the best score", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 99],
        [2, "1234567890", "Muhammad Rizki", 98],
        [],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 70],
      ],
    }), { students });
    const selectedRegion = analysis.regions.find((region) => region.headerRowIndex === 5);
    const plan = buildImportPlan(analysis, context, { selectedRegionId: selectedRegion?.id });

    expect(analysis.bestRegion?.headerRowIndex).toBe(1);
    expect(selectedRegion?.id).toBe("Nilai:5:6:6");
    expect(plan.conflicts.map((item) => item.code)).not.toContain("IMPORT_REGION_SELECTION_REQUIRED");
    expect(plan.gradeOperations).toHaveLength(1);
    expect(plan.gradeOperations[0]).toMatchObject({
      rowIndex: 6,
      studentId: "student-1",
      value: 70,
    });
  });

  it("keeps student edge cases safe across exact, normalized, duplicate, missing, and web-only rows", () => {
    const matchResult = matchStudents([
      { rowIndex: 2, name: "Siti Aminah", nisn: "0012345678" },
      { rowIndex: 3, name: "Muhammad Rizki", nisn: "1234567890.0" },
    ], students);
    const duplicateWeb = matchStudents([
      { rowIndex: 2, name: "Siti Aminah", nisn: "0012345678" },
    ], [
      students[0],
      { id: "student-3", name: "Siti Aminah Lain", nisn: "0012345678" },
    ]);
    const duplicateExcel = matchStudents([
      { rowIndex: 2, name: "Siti Aminah", nisn: "0012345678" },
      { rowIndex: 3, name: "Siti Aminah", nisn: "0012345678" },
    ], students);

    expect(matchResult.mappings.map((mapping) => mapping.matchedBy)).toEqual(["nisn_exact", "nisn_normalized"]);
    expect(duplicateWeb.mappings[0]).toMatchObject({ status: "ambiguous" });
    expect(duplicateWeb.conflicts.map((item) => item.code)).toContain("STUDENT_MATCH_AMBIGUOUS");
    expect(duplicateExcel.mappings.map((mapping) => mapping.status)).toEqual(["blocked", "blocked"]);
    expect(duplicateExcel.conflicts.map((item) => item.code)).toContain("STUDENT_DUPLICATE_EXCEL_MATCH");

    const missingWithValuePlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "9999999999", "Siswa File Lain", 75],
      ],
    }), { students }), context);
    const missingWithoutValuePlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "9999999999", "Siswa File Lain", ""],
      ],
    }), { students }), context);
    const webOnlyPlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 80],
      ],
    }), { students: [...students, { id: "student-3", name: "Ahmad Fauzi", nisn: "555" }] }), {
      ...context,
      students: [...students, { id: "student-3", name: "Ahmad Fauzi", nisn: "555" }],
    });
    const missingWithValueExecutable = buildExecutableImportOperations({ plan: missingWithValuePlan });
    const missingWithoutValueExecutable = buildExecutableImportOperations({ plan: missingWithoutValuePlan });
    const missingWithValueFixes = simplifyImportConflicts({ plan: missingWithValuePlan });
    const webOnlyPreview = buildSpreadsheetPreviewModel({ plan: webOnlyPlan });

    expect(missingWithValuePlan.studentMappings[0]?.status).toBe("missing_in_web");
    expect(missingWithValuePlan.gradeOperations[0]?.action).toBe("blocked");
    expect(missingWithValuePlan.gradeOperations[0]?.conflicts.map((item) => item.code)).toContain("IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE");
    expect(missingWithValueFixes.manualRequiredCount).toBeGreaterThan(0);
    expect(missingWithValueExecutable.summary.unresolvedStudentCount).toBe(1);
    expect(missingWithValueExecutable.operations).toHaveLength(0);
    expect(missingWithoutValuePlan.gradeOperations[0]?.action).toBe("skip_empty");
    expect(missingWithoutValueExecutable.summary.blockedCount).toBe(0);
    expect(missingWithoutValueExecutable.summary.skippedEmptyCount).toBeGreaterThan(0);
    expect(webOnlyPlan.missingInExcelStudents).toHaveLength(2);
    expect(webOnlyPlan.studentMappings.map((mapping) => mapping.rowIndex)).not.toContain(-1);
    expect(new Set(webOnlyPreview.rows.map((row) => row.id)).size).toBe(webOnlyPreview.rows.length);
  });

  it("keeps column matching canonical and detects duplicate targets", () => {
    const direct = matchColumns([
      { columnIndex: 4, rawHeader: "BAB 1 - Tugas 1" },
      { columnIndex: 5, rawHeader: "Bab I - Tugas 1" },
      { columnIndex: 6, rawHeader: "Tugas 1" },
      { columnIndex: 7, rawHeader: "UTS" },
      { columnIndex: 8, rawHeader: "PTS" },
      { columnIndex: 9, rawHeader: "UAS" },
      { columnIndex: 10, rawHeader: "PAS" },
      { columnIndex: 11, rawHeader: "Rapor" },
    ], chapters, assignments);
    const duplicatePlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1", "Bab I - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 80, 81],
      ],
    }), { students }), context);

    expect(direct.mappings.find((mapping) => mapping.columnIndex === 4)).toMatchObject({ targetType: "existing_assignment", target: { assignmentId: "assignment-1" } });
    expect(direct.mappings.find((mapping) => mapping.columnIndex === 5)).toMatchObject({ targetType: "existing_assignment", target: { assignmentId: "assignment-1" } });
    expect(direct.mappings.find((mapping) => mapping.columnIndex === 6)).toMatchObject({ targetType: "unresolved", status: "ambiguous" });
    expect(direct.mappings.filter((mapping) => ["sts", "sas"].includes(mapping.targetType)).map((mapping) => mapping.targetType)).toEqual(["sts", "sts", "sas", "sas"]);
    expect(direct.mappings.find((mapping) => mapping.columnIndex === 11)?.targetType).toBe("ignore");
    expect(duplicatePlan.conflicts.map((item) => item.code)).toContain("IMPORT_DUPLICATE_COLUMN_TARGET");
  });

  it("keeps value parser edge cases explicit", () => {
    expect(parseGradeValue(85)).toMatchObject({ status: "valid", value: 85 });
    expect(parseGradeValue(0)).toMatchObject({ status: "valid", value: 0 });
    expect(parseGradeValue("85,5")).toMatchObject({ status: "valid", value: 85.5 });
    expect(parseGradeValue("85,5").warnings.map((item) => item.code)).toContain("GRADE_VALUE_DECIMAL_COMMA");
    expect(parseGradeValue("85%")).toMatchObject({ status: "valid", value: 85 });
    expect(parseGradeValue("85%").warnings.map((item) => item.code)).toContain("GRADE_VALUE_PERCENT");
    expect(parseGradeValue("90/100")).toMatchObject({ status: "valid", value: 90 });
    expect(parseGradeValue("90/100").warnings.map((item) => item.code)).toContain("GRADE_VALUE_FRACTION_100");
    expect(parseGradeValue("8/10")).toMatchObject({ status: "needs_confirmation", value: null, suggestedValue: 80 });
    expect(parseGradeValue("4/5")).toMatchObject({ status: "needs_confirmation", value: null, suggestedValue: 80 });
    expect(parseGradeValue("18/20")).toMatchObject({ status: "needs_confirmation", value: null, suggestedValue: 90 });
    expect(parseGradeValue("-")).toMatchObject({ status: "empty", value: null });
    expect(parseGradeValue("N/A")).toMatchObject({ status: "empty", value: null });
    expect(parseGradeValue("belum dinilai")).toMatchObject({ status: "empty", value: null });
    expect(parseGradeValue("#VALUE!").status).toBe("invalid");
    expect(["Tuntas", "Remedial", "A"].map((value) => parseGradeValue(value))).toEqual([
      expect.objectContaining({ status: "textual", value: null }),
      expect.objectContaining({ status: "textual", value: null }),
      expect.objectContaining({ status: "textual", value: null }),
    ]);
    expect(parseGradeValue("101").status).toBe("invalid");
    expect(parseGradeValue("-1").status).toBe("invalid");
    expect(parseGradeValue("18/0").status).toBe("invalid");
  });

  it("keeps executable builder and preview aligned for mixed safe, skipped, overwrite, and suggested values", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 80],
        [2, "1234567890", "Muhammad Rizki", "18/20"],
      ],
    }), { students });
    const plan = buildImportPlan(analysis, {
      ...context,
      existingGrades: [{ student_id: "student-1", grade_type: "assignment", assignment_id: "assignment-1", value: 70 }],
    }, { updateMode: "overwrite_existing" });
    const blocked = buildExecutableImportOperations({ plan, updateMode: "overwrite_existing" });
    const acceptedSelection = {
      columnSettings: {
        "excel-col-4": {
          columnId: "excel-col-4",
          columnIndex: 4,
          include: true,
          valueMode: "overwrite_existing" as const,
          overwriteConfirmed: true,
        },
      },
      cellSettings: {
        "row-3:excel-col-4": {
          cellId: "row-3:excel-col-4",
          rowId: "row-3",
          columnId: "excel-col-4",
          include: true,
          valueMode: "inherit_column" as const,
          acceptedSuggestedValue: true,
          resolvedValue: 90,
        },
      },
    };
    const executable = buildExecutableImportOperations({ plan, updateMode: "overwrite_existing", selectionState: acceptedSelection });
    const preview = buildSpreadsheetPreviewModel({ plan, updateMode: "overwrite_existing", selectionState: acceptedSelection });
    const skippedByColumn = buildExecutableImportOperations({
      plan,
      selectionState: {
        columnSettings: {
          "excel-col-4": { columnId: "excel-col-4", columnIndex: 4, include: false, valueMode: "fill_empty_only" },
        },
        cellSettings: {},
      },
    });
    const skippedByCell = buildExecutableImportOperations({
      plan,
      selectionState: {
        columnSettings: {},
        cellSettings: {
          "row-2:excel-col-4": { cellId: "row-2:excel-col-4", rowId: "row-2", columnId: "excel-col-4", include: false, valueMode: "inherit_column" },
        },
      },
    });
    const skippedByRow = buildExecutableImportOperations({ plan, resolverState: { ignoredRows: [2] } });

    expect(blocked.summary.overwriteNeedsConfirmationCount).toBe(1);
    expect(blocked.summary.blockedCount).toBe(2);
    expect(executable.summary.executableCount).toBe(2);
    expect(executable.summary.overwriteCount).toBe(1);
    expect(executable.operations.find((operation) => operation.rowIndex === 3)?.value).toBe(90);
    expect(preview.summary.includedCells).toBe(executable.summary.executableCount);
    expect(skippedByColumn.summary.skippedManualCount).toBe(2);
    expect(skippedByCell.summary.skippedManualCount).toBe(1);
    expect(skippedByRow.summary.skippedManualCount).toBe(1);
  });

  it("guards unified contextual import policy in source until a component test harness is added", () => {
    const dialogSource = readFileSync(repoPath("apps/frontend/src/components/grades/GradeImportExportDialog.tsx"), "utf8");
    const overlaySource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/ColumnSettingsOverlay.tsx"), "utf8");
    const previewSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/SmartSpreadsheetPreview.tsx"), "utf8");
    const previewBannerSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/PreviewSummaryBanner.tsx"), "utf8");
    const previewBadgeSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/PreviewCellBadge.tsx"), "utf8");
    const statusBadgeSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/StatusBadge.tsx"), "utf8");
    const issueStepSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/ImportIssueResolutionStep.tsx"), "utf8");
    const headerStepSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/HeaderConfigurationStep.tsx"), "utf8");
    const fixPanelSource = readFileSync(repoPath("apps/frontend/src/components/grades/import-export/PreviewFixPanel.tsx"), "utf8");
    const gradesPageSource = readFileSync(repoPath("apps/frontend/src/pages/Grades.tsx"), "utf8");
    const spreadsheetSource = readFileSync(repoPath("apps/frontend/src/components/grades/SpreadsheetTable.tsx"), "utf8");
    const gradeInputCellSource = readFileSync(repoPath("apps/frontend/src/components/grades/GradeInputCell.tsx"), "utf8");
    const rankingSource = readFileSync(repoPath("apps/frontend/src/pages/StudentRankings.tsx"), "utf8");
    const gradeTableColorSchemeSource = readFileSync(repoPath("apps/frontend/src/lib/gradeTableColorSchemes.ts"), "utf8");
    const gradeTableColorSchemeHookSource = readFileSync(repoPath("apps/frontend/src/hooks/useGradeTableColorScheme.ts"), "utf8");
    const settingsSource = readFileSync(repoPath("apps/frontend/src/pages/Settings.tsx"), "utf8");
    const searchSource = readFileSync(repoPath("apps/frontend/src/components/grades/SmartStudentSearch.tsx"), "utf8");
    const formulaSource = readFileSync(repoPath("apps/frontend/src/lib/gradeFormula.ts"), "utf8");
    const roundingDialogSource = readFileSync(repoPath("apps/frontend/src/components/grades/ReportRoundingSettingsDialog.tsx"), "utf8");
    const restoreDialogSource = readFileSync(repoPath("apps/frontend/src/components/grades/GradeBackupRestoreDialog.tsx"), "utf8");
    const restoreReaderSource = readFileSync(repoPath("apps/frontend/src/lib/gradeImport/gradeBackupRestoreReader.ts"), "utf8");
    const backupExporterSource = readFileSync(repoPath("apps/frontend/src/lib/gradeImport/currentGradesExporter.ts"), "utf8");
    const dialogPrimitiveSource = readFileSync(repoPath("apps/frontend/src/components/ui/dialog.tsx"), "utf8");
    const globalStyles = readFileSync(repoPath("apps/frontend/src/index.css"), "utf8");

    expect(gradesPageSource).toContain("sipena-grade-page");
    expect(gradesPageSource).toContain("sipena-grade-table-shell");
    expect(spreadsheetSource).not.toContain("CHAPTER_HEADER_TONES");
    expect(spreadsheetSource).not.toContain("FINAL_COLUMN_TONES");
    expect(spreadsheetSource).toContain("tableColorScheme");
    expect(spreadsheetSource).toContain("getGradeTableColumnHeaderTone");
    expect(spreadsheetSource).toContain("getGradeTableColumnBodyTone");
    expect(gradesPageSource).toContain("tableColorScheme={gradeTableColorScheme}");
    expect(gradeTableColorSchemeSource).toContain('DEFAULT_GRADE_TABLE_COLOR_SCHEME: GradeTableColorSchemeId = "classic"');
    expect(gradeTableColorSchemeSource).toContain('id: "current"');
    expect(gradeTableColorSchemeSource).toContain('id: "future"');
    expect(gradeTableColorSchemeSource).toContain("selectable: false");
    expect(gradeTableColorSchemeSource).toContain("bg-slate-300/55");
    expect(gradeTableColorSchemeSource).toContain('column.type === "chapter_avg" || column.type === "final"');
    expect(gradeTableColorSchemeSource).toContain("bg-indigo-100/45");
    expect(gradeTableColorSchemeSource).toContain("bg-purple-100/45");
    expect(gradeTableColorSchemeHookSource).toContain("isRecoverablePreferenceError");
    expect(gradeTableColorSchemeHookSource).toContain("grade_table_color_scheme");
    expect(gradeTableColorSchemeHookSource).toContain(".update({");
    expect(gradeTableColorSchemeHookSource).toContain(".insert({");
    expect(settingsSource).toContain("Warna Tabel Nilai");
    expect(settingsSource).toContain("GradeTableSchemePreview");
    expect(settingsSource).toContain("Palet Tema SIPENA");
    expect(settingsSource).toContain("Rapor");
    expect(settingsSource).toContain("Akan datang");
    expect(settingsSource).toContain("disabled={isDisabled}");
    expect(gradesPageSource).toContain("overflow-visible border border-border shadow-sm");
    expect(gradesPageSource).toContain("relative z-30 bg-card");
    expect(spreadsheetSource).toContain("label: 'Rata-rata'");
    expect(spreadsheetSource).toContain("column.type === 'chapter_avg'");
    expect(spreadsheetSource).toContain("isAverageColumn");
    expect(spreadsheetSource).toContain("hoveredRowIndex");
    expect(spreadsheetSource).toContain("hoveredColumnIndex");
    expect(spreadsheetSource).toContain("setHoveredRowIndex(rowIndex)");
    expect(spreadsheetSource).toContain("setHoveredColumnIndex(colIndex)");
    expect(spreadsheetSource).toContain("getColumnHeaderTone(column, activeTableColorScheme)");
    expect(spreadsheetSource).toContain("getColumnBodyTone(column, activeTableColorScheme)");
    expect(spreadsheetSource).toContain("getGradeTextColor");
    expect(spreadsheetSource).toContain("getGradeTableAverageCellTone(activeTableColorScheme)");
    expect(spreadsheetSource).toContain("getGradeColor(finalValue, kkm)");
    expect(spreadsheetSource).toContain("colorClass || getGradeTableAverageCellTone(activeTableColorScheme)");
    expect(gradeInputCellSource).toContain("text-rose-600");
    expect(gradeInputCellSource).toContain("bg-rose-100");
    expect(gradeInputCellSource).toContain("text-amber-600");
    expect(gradeInputCellSource).toContain("bg-amber-100");
    expect(spreadsheetSource).toContain("bg-fuchsia-100/95");
    expect(spreadsheetSource).toContain("sipena-grade-scroll");
    expect(spreadsheetSource).toContain("overscrollBehaviorY: 'auto'");
    expect(spreadsheetSource).toContain("isStandaloneFinalColumn(column)");
    expect(spreadsheetSource).toContain("height: totalHeaderHeight * zoomFactor");
    expect(spreadsheetSource).toContain("touchAction: 'pan-x pan-y'");
    expect(spreadsheetSource).toContain("sipena-grade-toolbar");
    expect(spreadsheetSource).toContain("sipena-grade-toolbar-extra");
    expect(spreadsheetSource).toContain("Prediksi nilai tetap tersedia lewat long-press");
    expect(spreadsheetSource).not.toContain("fixed top-2 right-2 z-[10000]");
    expect(spreadsheetSource).toContain("estimateWrappedLineCount");
    expect(spreadsheetSource).toContain("getRowHeight(rowIndex)");
    expect(spreadsheetSource).toContain("whitespace-normal break-words font-medium");
    expect(spreadsheetSource).not.toContain("label: 'Avg'");
    expect(searchSource).toContain("h-10 pl-8 pr-9");
    expect(searchSource).toContain("whitespace-normal break-words");
    expect(searchSource).toContain("selectAllOnNextFocusRef");
    expect(searchSource).toContain("inputRef.current?.select()");
    expect(searchSource).toContain("data-grade-student-search");
    expect(searchSource).not.toContain("Sparkles");
    expect(gradesPageSource).toContain("ReportRoundingSettingsDialog");
    expect(gradesPageSource).toContain("showReportRoundingSettings");
    expect(gradesPageSource).toContain("getReportRoundingLabel(formula.reportRounding.mode)");
    expect(gradesPageSource).toContain("getReportRoundingTargetLabel(formula.reportRounding.target)");
    expect(formulaSource).toContain("ReportRoundingMode");
    expect(formulaSource).toContain("ReportRoundingTarget");
    expect(formulaSource).toContain("applyReportGradeRounding");
    expect(formulaSource).toContain("getReportRoundingLabel");
    expect(formulaSource).toContain("shouldApplyReportRounding");
    expect(roundingDialogSource).toContain("Pembulatan Nilai");
    expect(roundingDialogSource).toContain("Terapkan ke");
    expect(roundingDialogSource).toContain("Rata-rata BAB");
    expect(roundingDialogSource).toContain("Simpan Pembulatan");
    expect(globalStyles).toContain(".sipena-grade-page");
    expect(globalStyles).toContain(".sipena-grade-table-shell");
    expect(globalStyles).toContain("@media (max-width: 380px)");

    expect(dialogSource).toContain('setUpdateMode("fill_empty_only")');
    expect(dialogSource).toContain("Import dibatalkan karena masih ada nilai yang perlu dicek atau konfirmasi timpa.");
    expect(dialogSource).toContain("onRollbackCreatedImportStructure");
    expect(dialogSource).toContain('plan?.sourceType === "free_unstructured" && plan.gradeOperations.length === 0');
    expect(dialogSource).not.toContain("ImportComplexityMode");
    expect(dialogSource).not.toContain("Mode Cepat aktif");
    expect(dialogSource).not.toContain("Mode Lanjutan aktif");
    expect(dialogSource).toContain('const importSteps = ["Upload", "Pemeriksaan", "Daftar Bermasalah", "Konfigurasi Header", "Verifikasi Tabel", "Review Akhir", "Simpan"]');
    expect(dialogSource).not.toContain("AI Agent Menyelesaikan");
    expect(dialogSource).toContain("Template resmi siap diperiksa");
    expect(dialogSource).toContain("Identitas template SIPENA valid. Periksa Daftar Bermasalah dulu sebelum melihat tabel verifikasi.");
    expect(dialogSource).toContain("getActiveImportIssues(spreadsheetPreview)");
    expect(dialogSource).toContain("getActiveHeaderConfigurationIssues(spreadsheetPreview, effectiveSelectionState)");
    expect(dialogSource).toContain("getImportStepReadiness");
    expect(dialogSource).toContain("buildImportDecisionGraph");
    expect(dialogSource).toContain("buildFinalReviewModel");
    expect(dialogSource).not.toContain("FinalReviewSpreadsheetTable");
    expect(dialogSource).toContain("<SpreadsheetPreviewStep");
    expect(previewSource).toContain("sipena-preview-header-button");
    expect(previewSource).toContain("ColumnSettingsOverlay");
    expect(previewSource).not.toContain('type PreviewMode = "quick" | "detail"');
    expect(previewSource).not.toContain("Mode Cepat");
    expect(previewSource).not.toContain("Mode Detail");
    expect(previewSource).not.toContain("Terapkan pemeriksaan otomatis");
    expect(previewSource).not.toContain("sipena-preview-mode-toggle");
    expect(previewSource).toContain("sipena-preview-status-pill");
    expect(previewSource).toContain("Klik header untuk atur kolom");
    expect(previewSource).toContain("Klik sel untuk pakai/lewati");
    expect(previewSource).toContain("previewCellDetailLines");
    expect(previewSource).toContain("columnStatsDetail");
    expect(previewSource).not.toContain("needsCompactCellActions");
    expect(previewSource).not.toContain("sipena-preview-cell-action");
    expect(previewSource).toContain("<PreviewFixPanel");
    expect(previewSource).toContain("Excel:");
    expect(previewSource).toContain("Lama:");
    expect(previewSource).toContain("Saran:");
    expect(previewSource).toContain("Perlu cek");
    expect(previewSource).toContain("onResetCellSelection={onResetCellSelection}");
    expect(dialogSource).toContain("onResetRowSelection");
    expect(dialogSource).toContain("ignoredCells: current.ignoredCells.filter");
    expect(fixPanelSource).toContain("Pakai rekomendasi");
    expect(fixPanelSource).toContain("Pilih Siswa yang Sudah Ada");
    expect(fixPanelSource).toContain('actionPlacement?: "top" | "hidden"');
    expect(fixPanelSource).not.toContain("sipena-preview-fix-actions");
    expect(fixPanelSource).not.toContain("Terapkan pemeriksaan otomatis");
    expect(issueStepSource).toContain("Daftar Bermasalah");
    expect(issueStepSource).not.toContain("InlineColumnTargetFix");
    expect(issueStepSource).toContain("Bandingkan baris nama redundan");
    expect(issueStepSource).toContain("Masalah ${Math.max(1, activePendingIndex + 1)} dari ${activeIssueCount || 1}");
    expect(issueStepSource).toContain("Lihat detail");
    expect(issueStepSource).toContain("completedIssues");
    expect(issueStepSource).not.toContain("AutomaticHeaderCheckDialog");
    expect(issueStepSource).not.toContain("sipena-auto-check-trigger--attention");
    expect(issueStepSource).not.toContain("Pakai saran AI");
    expect(headerStepSource).toContain("Konfigurasi Header");
    expect(headerStepSource).toContain("buildHeaderConfigurationQueue");
    expect(headerStepSource).toContain('onSetColumnValueMode(issue.column, "overwrite_existing", true)');
    expect(headerStepSource).toContain('type HeaderFilter = "action" | "all" | "done"');
    expect(headerStepSource).toContain('placeholder="Cari header"');
    expect(headerStepSource).toContain("Contoh nilai terdampak");
    expect(headerStepSource).toContain("Simpan target & aturan");
    expect(headerStepSource).not.toContain('type="checkbox"');
    expect(headerStepSource).toContain("Saran AI:");
    expect(issueStepSource).toContain("masalah tersisa");
    expect(dialogSource).toContain("importBodyRef.current?.scrollTo({ top: 0");
    expect(dialogSource).toContain("sipena-import-body--issue-step");
    expect(dialogSource).toContain("footerStatusLabel");
    expect(dialogSource).toContain("lg:flex-row lg:items-center lg:justify-between");
    expect(dialogSource).toContain("lg:w-80");
    expect(dialogSource).not.toContain('className="shrink-0 border-b border-border bg-white px-4 py-3 dark:bg-slate-950 sm:px-6"');
    expect(globalStyles).toContain("sipena-preview-header-target");
    expect(globalStyles).toContain("sipena-preview-cell-details");
    expect(globalStyles).toContain("sipena-preview-cell-actions");
    expect(globalStyles).toContain("sipena-issue-active-summary");
    expect(globalStyles).toContain("sipena-header-config-grid");
    expect(headerStepSource).toContain("Urutan header Excel");
    expect(globalStyles).toContain("sipena-header-list-tools");
    expect(globalStyles).toContain("sipena-header-filter-tabs");
    expect(headerStepSource).toContain("sipena-header-workspace");
    expect(headerStepSource).toContain("sipena-header-editor-panel");
    expect(headerStepSource).toContain("sipena-header-evidence-panel");
    expect(headerStepSource).toContain("openEvidenceByHeaderId");
    expect(headerStepSource).toContain("Lihat contoh nilai");
    expect(headerStepSource).toContain("Sembunyikan contoh");
    expect(headerStepSource).toContain("isEvidenceOpen ? (");
    expect(globalStyles).toContain("sipena-header-workspace");
    expect(globalStyles).toContain("sipena-header-workspace--evidence-open");
    expect(globalStyles).toContain("sipena-header-editor-panel");
    expect(globalStyles).toContain("sipena-header-evidence-panel");
    expect(globalStyles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(globalStyles).not.toContain("sipena-header-decision-panel");
    expect(headerStepSource).toContain("sipena-header-unified-actions");
    expect(headerStepSource).not.toContain("sipena-header-secondary-actions");
    expect(headerStepSource).not.toContain("sipena-header-sequence-actions");
    expect(globalStyles).toContain("sipena-header-unified-actions");
    expect(globalStyles).not.toContain("sipena-header-secondary-actions");
    expect(globalStyles).not.toContain("sipena-header-sequence-actions");
    expect(globalStyles).toContain("sipena-issue-list-item--done");
    expect(globalStyles).toContain("sipena-import-body--issue-step");
    expect(dialogSource).not.toContain("sticky bottom-0 z-20 shrink-0 border-t");
    expect(globalStyles).toContain("overflow-y: auto");
    expect(globalStyles).toContain("padding-bottom: 18px");
    expect(globalStyles).toContain("scroll-padding-bottom: 24px");
    expect(globalStyles).toContain("max-height: clamp(360px, calc(100dvh - 250px), 760px)");
    expect(globalStyles).toContain("overscroll-behavior: contain");
    expect(globalStyles).not.toContain("height: clamp(520px, calc(100dvh - 238px), 720px)");
    expect(globalStyles).not.toContain("scroll-padding-bottom: 128px");
    expect(globalStyles).not.toContain("padding-bottom: 144px");
    expect(globalStyles).toContain("grid-template-columns: clamp(220px, 24vw, 300px) minmax(0, 1fr)");
    expect(globalStyles).toContain("scroll-snap-type: x proximity");
    expect(globalStyles).toContain("sipena-preview-modebar");
    expect(globalStyles).toContain("sipena-preview-status-pill--ready");
    expect(globalStyles).not.toContain("sipena-preview-shell--quick");
    expect(globalStyles).toContain("--sipena-preview-sticky-3: 152px");
    expect(globalStyles).toContain("width: 184px");
    expect(previewBadgeSource).toContain("Tidak valid");
    expect(previewBannerSource).toContain("Klik header untuk atur kolom");
    expect(dialogSource).toContain("Tabel akhir hasil");
    expect(dialogSource).toContain("Detail keputusan import");
    expect(dialogSource).toContain("Sumber Excel");
    expect(dialogSource).toContain("Target SIPENA");
    expect(dialogSource).toContain("Nilai Excel");
    expect(dialogSource).toContain("Nilai final");
    expect(dialogSource).toContain("Buka Verifikasi Tabel");
    expect(dialogSource).not.toContain("Ringkasan tabel terverifikasi");
    expect(dialogSource).toContain("Review Akhir hanya menampilkan nilai yang akan disimpan");
    expect(dialogSource).toContain("reviewDecisionValueLabel");
    expect(dialogSource).toContain("Konfigurasi Header atau nilai dari Verifikasi Tabel");
    expect(dialogSource).not.toContain("warning utama");
    expect(dialogSource).not.toContain("item diblokir");
    expect(dialogSource).not.toContain("title: cleanBackendText(code");
    expect(dialogSource).toContain("Import Nilai");
    expect(dialogSource).toContain("Download Template Resmi");
    expect(dialogSource).toContain("Upload Excel");
    expect(dialogSource).not.toContain("onOpenLegacyImport");
    expect(dialogSource).not.toContain("Buka import lama");
    expect(gradesPageSource).not.toContain("ImportGradesDialog");
    expect(gradesPageSource).not.toContain("showImportGrades");
    expect(gradesPageSource).not.toContain("Import dari Excel Lama");
    expect(gradesPageSource).toContain("Kelola Nilai");
    expect(gradesPageSource).toContain("Backup / Restore");
    expect(gradesPageSource).toContain("Konfirmasi Backup Lengkap Nilai");
    expect(gradesPageSource).toContain("Lindungi restore dengan metadata");
    expect(gradesPageSource).toContain("protectGradeBackupMetadata");
    expect(gradesPageSource).toContain("<GradeBackupRestoreDialog");
    expect(gradesPageSource).toContain("onRestoreBatch={async (items) => saveGradesBatchWithUndo(items)}");
    expect(restoreDialogSource).toContain("readGradeBackupWorkbook");
    expect(restoreDialogSource).toContain("buildGradeBackupRestorePlan");
    expect(restoreDialogSource).toContain("buildGradeBackupRestoreBatchItems");
    expect(restoreReaderSource).toContain("parseVisibleGrades");
    expect(restoreReaderSource).toContain("mergeVisibleGrades");
    expect(restoreReaderSource).toContain("isMetadataLockedBackup");
    expect(restoreReaderSource).toContain('getSheet(workbook, "Nilai")');
    expect(backupExporterSource).toContain("metadata_locked");
    expect(backupExporterSource).toContain("visible_sheet_override");
    expect(backupExporterSource).toContain("Mode perlindungan metadata AKTIF");
    expect(restoreDialogSource).toContain("uploadRunRef");
    expect(restoreDialogSource).toContain("resetUploadState");
    expect(restoreDialogSource).toContain("event.currentTarget.value = \"\"");
    expect(restoreDialogSource).toContain("RestorePreviewTable");
    expect(restoreDialogSource).toContain("Preview tabel restore");
    expect(restoreDialogSource).toContain("sipena-grade-restore-dialog");
    expect(restoreDialogSource).toContain("sipena-grade-import-dialog sipena-grade-restore-dialog");
    expect(restoreDialogSource).toContain("grid-rows-none");
    expect(restoreDialogSource).toContain("sipena-preview-grid-wrap");
    expect(restoreDialogSource).toContain("sipena-preview-scroll");
    expect(restoreDialogSource).toContain("sipena-preview-table");
    expect(restoreDialogSource).toContain("sipena-preview-cell--new-value");
    expect(restoreDialogSource).toContain("sipena-preview-cell--overwrite");
    expect(restoreDialogSource).toContain("TooltipProvider");
    expect(restoreDialogSource).toContain("operationNotes");
    expect(restoreDialogSource).toContain("OperationNoteBadge");
    expect(restoreDialogSource).toContain("Upload & Validasi");
    expect(restoreDialogSource).toContain("sipena-restore-dropzone");
    expect(restoreDialogSource).toContain("onDrop={handleUploadDrop}");
    expect(restoreDialogSource).toContain("onDragOver={handleUploadDragOver}");
    expect(restoreDialogSource).toContain("sipena-preview-sticky-left sipena-preview-visual--neutral");
    expect(restoreDialogSource).toContain("stickyStyle(index)");
    expect(restoreDialogSource).toContain("[\"No\", \"NISN\", \"Siswa\"]");
    expect(restoreDialogSource).toContain("RestoreOperationInspector");
    expect(restoreDialogSource).toContain("RestoreModeFooterCard");
    expect(restoreDialogSource).toContain("OverwriteSelectionDialog");
    expect(restoreDialogSource).toContain("sipena-restore-mode-trigger");
    expect(restoreDialogSource).toContain("sipena-restore-mode-popover");
    expect(restoreDialogSource).toContain("sipena-restore-overwrite-layer");
    expect(restoreDialogSource).toContain("sipena-restore-footer-mode-controls");
    expect(restoreDialogSource.indexOf("<OverwriteSelectionDialog")).toBeLessThan(restoreDialogSource.indexOf("</DialogContent>"));
    expect(restoreDialogSource).toContain("Kosongkan nilai web jika backup kosong");
    expect(restoreDialogSource).toContain("sipena-guided-action");
    expect(restoreDialogSource).toContain("sipena-ai-note-badge");
    expect(restoreDialogSource).toContain("Preview & Pilih Mode");
    expect(restoreDialogSource).toContain("allowIdentityMismatch");
    expect(restoreDialogSource).toContain("sipena-restore-cell-interactive");
    expect(restoreDialogSource).toContain("sipena-restore-cell-final-included");
    expect(restoreDialogSource).toContain("Preview akhir restore");
    expect(restoreDialogSource).toContain("h-[calc(100dvh-0.25rem)]");
    expect(restoreDialogSource).toContain("max-w-[1880px]");
    expect(restoreDialogSource).not.toContain("sipena-restore-preview-scroll");
    expect(restoreDialogSource).not.toContain("sipena-restore-preview-mobile");
    expect(restoreDialogSource).not.toContain("sipena-restore-preview-table");
    expect(restoreDialogSource).not.toContain("space-y-3 md:hidden");
    expect(restoreDialogSource).not.toContain("gridTemplateColumns");
    expect(restoreDialogSource).not.toContain("min-w-[760px]");
    expect(restoreDialogSource).not.toContain("min-w-[14rem]");
    expect(restoreDialogSource).not.toContain("min-w-[11rem]");
    expect(restoreDialogSource).not.toContain("w-32 min-w-32");
    expect(restoreDialogSource).not.toContain(">\\n            Tutup\\n          </Button>");
    expect(globalStyles).not.toContain(".sipena-restore-preview-table");
    expect(globalStyles).toContain(".sipena-preview-table");
    expect(globalStyles).toContain(".sipena-preview-cell--new-value");
    expect(globalStyles).toContain(".sipena-preview-cell--overwrite");
    expect(globalStyles).toContain(".sipena-restore-dropzone");
    expect(globalStyles).toContain(".sipena-restore-inspector");
    expect(globalStyles).toContain(".sipena-restore-mode-trigger");
    expect(globalStyles).toContain(".sipena-restore-mode-popover");
    expect(globalStyles).toContain(".sipena-restore-footer-mode-controls");
    expect(globalStyles).toContain("flex-wrap: nowrap");
    expect(globalStyles).toContain(".sipena-restore-footer-mode-controls .sipena-restore-mode-trigger");
    expect(globalStyles).toContain(".sipena-restore-overwrite-backdrop");
    expect(globalStyles).toContain(".sipena-danger-icon-button");
    expect(dialogPrimitiveSource).toContain("sipena-danger-icon-button");
    expect(globalStyles).toContain(".sipena-grade-toolbar--fullscreen");
    expect(globalStyles).toContain("overscroll-behavior-y: auto");
    expect(globalStyles).toContain("orientation: landscape");
    expect(globalStyles).toContain("@media (orientation: landscape) and (max-height: 440px)");
    expect(rankingSource).not.toContain("<Tabs");
    expect(rankingSource).not.toContain("Per Mapel");
    expect(rankingSource).toContain("Peringkat gabungan satu kelas");
    expect(rankingSource).toContain("Mapel yang Dihitung");
    expect(rankingSource).toContain("aria-pressed={effectiveSelected}");
    expect(rankingSource).toContain("whitespace-normal break-words");
    expect(globalStyles).toContain("@keyframes sipena-guided-action-pulse");
    expect(globalStyles).toContain("@keyframes sipena-restore-drop-pulse");
    expect(globalStyles).toContain(".sipena-preview-cell-note-badge");
    expect(globalStyles).toContain("max-height: min(66dvh, 680px)");
    expect(restoreDialogSource).toContain("Saat ini");
    expect(restoreDialogSource).toContain("Backup");
    expect(restoreDialogSource).toContain("RESTORE NILAI");
    expect(restoreDialogSource).toContain("KOSONGKAN NILAI");
    expect(previewBadgeSource).toContain("Tooltip");
    expect(previewBadgeSource).toContain("previewCellBadgeText");
    expect(statusBadgeSource).toContain("description?: ReactNode");
    expect(spreadsheetSource).toContain('title="Reset semua pengaturan"');
    expect(spreadsheetSource).not.toContain('title="Reset semua"');
    expect(dialogSource).toContain("Pemeriksaan otomatis");
    expect(dialogSource).toContain("Saran AI");
    expect(dialogSource).toContain("requestSmartImportAssist");
    expect(dialogSource).toContain("Saran AI membantu menyelesaikan item yang belum jelas");
    expect(dialogSource).toContain("Saran ini tetap perlu dicek");
    expect(dialogSource).toContain("Minta Saran AI");
    expect(dialogSource).toContain("AI sedang membantu memeriksa file");
    expect(dialogSource).toContain("Gunakan siswa ini");
    expect(dialogSource).toContain("Gunakan target ini");
    expect(dialogSource).toContain("Gunakan tabel ini");
    expect(dialogSource).toContain("Gunakan nilai saran");
    expect(dialogSource).toContain("Abaikan saran");
    expect(dialogSource).toContain("Pilih manual");
    expect(dialogSource).toContain("Tidak ada nilai siap import.");
    expect(dialogSource).toContain("Pilih tabel nilai yang ingin dipakai.");
    expect(dialogSource).toContain("Selesaikan item yang wajib dipilih terlebih dahulu.");
    expect(dialogSource).toContain("Periksa item yang perlu dicek terlebih dahulu.");
    expect(dialogSource).toContain("Download template baru jika file berasal dari kelas/mapel/semester lain.");
    expect(dialogSource).toContain("Pilihan di sini hanya mengubah preview. Tidak ada nilai yang disimpan sebelum tahap import.");
    expect(dialogSource).toContain("Import batch dibatalkan. Tidak ada nilai yang disimpan karena proses atomic gagal.");
    expect(dialogSource).not.toContain("morphe-chat");
    expect(dialogSource).not.toContain("<ImportModeCard");
    expect(dialogSource).not.toContain("setImportMode");
    expect(overlaySource).toContain('if (column.isNewStructure) return "ignore"');
    expect(overlaySource).toContain('title="Tugas lain"');
    expect(overlaySource).toContain('title="Buat baru"');
    expect(overlaySource).toContain("Tugas baru di BAB ini");
    expect(overlaySource).toContain("BAB + tugas baru");
    expect(overlaySource).toContain('activeMode === "overwrite_existing"');
    expect(overlaySource).not.toContain("complexityMode");
    expect(fixPanelSource).toContain('(["fill_empty_only", "skip_existing", "overwrite_existing"] as ColumnValueMode[])');
    expect(fixPanelSource).toContain('(["inherit_column", "fill_empty_only", "skip_existing", "overwrite_existing"] as CellValueMode[])');
    expect(fixPanelSource).toContain('(columnSetting?.valueMode || targetColumn.effectiveValueMode) === "overwrite_existing"');
    expect(fixPanelSource).not.toContain("complexityMode");
    expect(headerStepSource).toContain("Target header");
    expect(headerStepSource).toContain("Konfigurasi Header");
    expect(dialogSource).toContain("sipena-smart-fix-needs");
    expect(dialogSource).toContain("Tinjau item perlu dicek");
    expect(issueStepSource).not.toContain("complexityMode");
  });

  it("guards atomic batch import RPC and duplicate-grade hard errors in SQL", () => {
    const sql = readFileSync(repoPath("supabase/migrations/20260509142802_atomic_grade_import.sql"), "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.import_grades_batch(p_items jsonb)");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("Data nilai duplikat ditemukan. Perlu perbaikan database sebelum menyimpan.");
    expect(sql).toContain("Nilai tugas pada item ke-% wajib memiliki assignment_id.");
    expect(sql).toContain("Nilai % pada item ke-% tidak boleh memiliki assignment_id.");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.import_grades_batch(jsonb) TO authenticated");
  });

  it("guards duplicate grade repair migration with archive-first cleanup and final unique constraint", () => {
    const sql = readFileSync(repoPath("supabase/migrations/20260604104807_repair_duplicate_grade_rows.sql"), "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.grade_duplicate_resolution_audit");
    expect(sql).toContain("ALTER TABLE public.grade_duplicate_resolution_audit ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("grade_duplicate_resolution_audit_select_own");
    expect(sql).toContain("WITH duplicate_stats AS");
    expect(sql).toContain("rows_to_remove AS");
    expect(sql).toContain("INSERT INTO public.grade_duplicate_resolution_audit");
    expect(sql).toContain("DELETE FROM public.grades");
    expect(sql.indexOf("INSERT INTO public.grade_duplicate_resolution_audit")).toBeLessThan(sql.indexOf("DELETE FROM public.grades"));
    expect(sql).toContain("UNIQUE NULLS NOT DISTINCT");
    expect(sql).toContain("grades_unique_owner_scope");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("guards web deploys against white blank screens", () => {
    const packageJson = readFileSync(repoPath("package.json"), "utf8");
    const deployScript = readFileSync(repoPath("scripts/netlify-deploy.mjs"), "utf8");
    const blankGuardScript = readFileSync(repoPath("scripts/verify-web-not-blank.mjs"), "utf8");

    expect(packageJson).toContain('"verify:web": "node scripts/verify-web-not-blank.mjs"');
    expect(packageJson).toContain('"verify:web:dist": "node scripts/verify-web-not-blank.mjs --dist apps/frontend/dist --no-render"');
    expect(deployScript).toContain('import { verifyRemoteSite } from "./verify-web-not-blank.mjs"');
    expect(deployScript).toContain("waitForDeployReady");
    expect(deployScript).toContain("verifyDeployUrl");
    expect(deployScript).toContain("await verifyRemoteSite");
    expect(blankGuardScript).toContain("verifyRemoteAssets");
    expect(blankGuardScript).toContain("verifyHeadlessRender");
    expect(blankGuardScript).toContain("Asset production berubah menjadi HTML fallback");
    expect(blankGuardScript).toContain("Render headless masih terlihat blank atau #root kosong");
    expect(blankGuardScript).toContain("--require-chrome");
  });
});
