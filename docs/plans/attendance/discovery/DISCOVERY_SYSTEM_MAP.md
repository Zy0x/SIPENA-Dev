# DISCOVERY SYSTEM MAP: Attendance V1

## Objective
Provide a precise forensic map of all system entry points, components, hooks, and utilities composing the Attendance V1 feature.

## Evidence from Actual Repo Files
- **Page Entry Point**: [Attendance.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/pages/Attendance.tsx) (handles UI layout, daily and monthly views, date switching, state binding).
- **Core Hook**: [useAttendance.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/hooks/useAttendance.ts) (manages Supabase data fetching, queries, and mutations).
- **Import Dialogs**:
  - [ImportAttendanceDialog.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/import/ImportAttendanceDialog.tsx) (Excel sheet import parsing and normalization).
  - [OCRImportDialog.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/import/OCRImportDialog.tsx) (Camera OCR scanning for physical attendance sheets).
- **Export Components & Pipelines**:
  - [UnifiedExportStudio.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/export/UnifiedExportStudio.tsx) (Unified Studio overlay and export formatting controls).
  - [AttendanceExportPreviewV2.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx) (HTML/Canvas live preview in export studio).
  - [attendancePdfExport.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/lib/attendancePdfExport.ts) (jsPDF rendering calculations).
  - [attendancePrintLayout.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/lib/attendancePrintLayout.ts) (Layout and dimensions calculations).
  - [attendanceExport.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/lib/attendanceExport.ts) (Vite/Excel column option mapping and XLS export polish).

## Findings
- **V1 Client Architecture**: The frontend uses `useAttendance` to fetch data from Supabase. The local React component `Attendance.tsx` directly renders daily list and monthly grids using inline styles and Radix UI primitives.
- **State Management**: State is localized inside `Attendance.tsx` (e.g., `selectedClassId`, `currentMonth`, `activeView`). The hook is loaded per class and month, refetching whenever `selectedClassId` or `currentMonth` changes.
- **Holidays & Day Events**: Holidays are retrieved from custom tables (`attendance_holidays`) and national holiday sync API hook (`useIndonesianHolidays`). Day events are stored in `attendance_day_events`.

## Risks
- **High Complexity Coupling**: The page `Attendance.tsx` directly references `students` array and queries/mutates data using functions returned by `useAttendance`. Any change in hook return signature will crash the UI.

## Safe Next Action
- Encapsulate `useAttendance` calls behind an adapter seam that maps legacy returns to a Canonical Attendance Model.
