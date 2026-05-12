import { analyzeFreeExcelWorkbook, analyzeOfficialTemplateWorkbook, type FreeExcelAnalysis, type ImportPlanContext, type OfficialTemplateAnalysis, type WorkbookReadResult } from "@/lib/gradeImport";

export type ImportSourceDetectionResult = {
  analysis: OfficialTemplateAnalysis | FreeExcelAnalysis;
  route: "official" | "free_excel";
  aiAllowed: boolean;
  reason: string;
};

export function detectGradeImportSource(workbook: WorkbookReadResult, context: ImportPlanContext): ImportSourceDetectionResult {
  const official = analyzeOfficialTemplateWorkbook(workbook, {
    classId: context.classId,
    subjectId: context.subjectId,
    semesterId: context.semesterId,
    academicYearId: context.academicYearId,
  });

  if (official.sourceType === "official_exact") {
    return {
      analysis: official,
      route: "official",
      aiAllowed: false,
      reason: "Template Resmi SIPENA valid. Metadata resmi dipakai langsung tanpa AI.",
    };
  }

  if (official.sourceType === "official_modified") {
    return {
      analysis: official,
      route: "official",
      aiAllowed: true,
      reason: "Template Resmi SIPENA berubah. Metadata tetap menjadi acuan utama, AI hanya boleh membantu item yang tidak jelas.",
    };
  }

  if (official.sourceType === "official_damaged") {
    const free = analyzeFreeExcelWorkbook(workbook, { students: context.students });
    return {
      analysis: free.sourceType === "free_structured" ? free : official,
      route: free.sourceType === "free_structured" ? "free_excel" : "official",
      aiAllowed: true,
      reason: "Metadata template resmi rusak atau hilang. SIPENA mencoba membaca sebagai Excel bebas.",
    };
  }

  return {
    analysis: analyzeFreeExcelWorkbook(workbook, { students: context.students }),
    route: "free_excel",
    aiAllowed: true,
    reason: "File dibaca sebagai Excel bebas.",
  };
}
