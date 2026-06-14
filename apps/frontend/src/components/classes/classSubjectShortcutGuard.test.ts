import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

describe("class subject shortcut guard", () => {
  it("routes a class card subject shortcut into a preselected add-subject flow", () => {
    const classCardSource = readSource("apps/frontend/src/components/classes/ClassCard.tsx");
    const classesSource = readSource("apps/frontend/src/pages/Classes.tsx");
    const subjectsSource = readSource("apps/frontend/src/pages/Subjects.tsx");
    const addSubjectSource = readSource("apps/frontend/src/components/subjects/AddSubjectDialog.tsx");

    expect(classesSource).toContain("const { allSubjects, isLoading: subjectsLoading } = useSubjects();");
    expect(classesSource).toContain("subjectCountByClassId");
    expect(classesSource).toContain("subjectCount={subjectCountByClassId.get(cls.id) || 0}");
    expect(classesSource).toContain("isSubjectCountLoading={subjectsLoading}");

    expect(classCardSource).toContain("handleTambahMapel");
    expect(classCardSource).toContain("action=add-subject");
    expect(classCardSource).toContain("encodeURIComponent(classData.id)");
    expect(classCardSource).toContain("navigate(hasSubjects ? subjectUrl : `${subjectUrl}&action=add-subject`)");
    expect(classCardSource).toContain("showMissingSubjectDialog");
    expect(classCardSource).toContain("Tambahkan Mapel Terlebih Dahulu");
    expect(classCardSource).toContain("setShowMissingSubjectDialog(true)");
    expect(classCardSource).toContain("<BookOpen");
    expect(classCardSource).toContain("<span className=\"truncate\">Mapel</span>");

    expect(subjectsSource).toContain('searchParams.get("action") === "add-subject"');
    expect(subjectsSource).toContain("openOnMountKey={addSubjectIntentKey}");
    expect(subjectsSource.match(/openOnMountKey=\{addSubjectIntentKey\}/g)).toHaveLength(1);

    expect(addSubjectSource).toContain("openOnMountKey?: string");
    expect(addSubjectSource).toContain("openedKeysRef.current.has(openOnMountKey)");
    expect(addSubjectSource).toContain("setOpen(true)");
  });
});
