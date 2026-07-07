import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("AttendanceV2 export dialog guard", () => {
  it("opens the export month picker before launching the export studio", () => {
    const page = readSource("apps/frontend/src/pages/AttendanceV2.tsx");
    const controls = readSource("apps/frontend/src/components/attendance/v2/AttendanceV2Controls.tsx");

    expect(page).toContain("openAttendanceExportMonthDialog: prepareAttendanceExportStudio");
    expect(page).toContain("const handleOpenAttendanceExportMonthDialog = useCallback");
    expect(page).toContain("prepareAttendanceExportStudio();");
    expect(page).toContain("setExportPickerYear(currentMonth.getFullYear());");
    expect(page).toContain("setShowExportMonthDialog(true);");
    expect(page).toContain("openAttendanceExportMonthDialog={handleOpenAttendanceExportMonthDialog}");
    expect(page).toContain("window.setTimeout(() => setShowExportDialog(true), 180)");
    expect(controls).toContain("onTriggerClick={openAttendanceExportMonthDialog}");
  });
});
