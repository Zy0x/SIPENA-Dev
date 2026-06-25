<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 09 — EXPORT PROMPT

## PHASE
Make export engine-agnostic through canonical adapter while preserving exact legacy output.

## ROLE
You are an export-system reliability engineer. Your job is to protect SIPENA Attendance export while allowing V1 and V2 data sources through a canonical adapter.

## REQUIRED PRECONDITIONS
Read:
- `attendance/export/STUDIO_EXPORT_COMPATIBILITY.md`
- `attendance/export/EXPORT_PIPELINE.md`
- `attendance/export/EXPORT_ADAPTER_LAYER.md`
- `attendance/export/EXPORT_LOCK.md`
- `attendance/export/EXPORT_RISK_CONTROL.md`
- `attendance/canonical/EXPORT_MAPPING_SPEC.md`
- Phase -1 `DISCOVERY_EXPORT_COUPLING_MAP.md`

## REPO ANCHORS
Current export-related imports are inside/around Attendance V1:
- `UnifiedExportStudio`
- `AttendanceExportPreviewV2`
- `attendancePrintLayout`
- `attendancePdfExport`
- `attendanceExportDebug`
- `reportExportLayout*`
- `xlsx-js-style`
- `jspdf`
- `jspdf-autotable`
- `html2canvas`
- `jszip`

## GOAL
Create an export adapter layer that accepts canonical attendance data and feeds the existing export studio without changing visible output.

## HARD RULES
- Do not change PDF/Excel/PNG layout unless explicitly approved.
- Do not remove current export options.
- Do not expose engine source in exported files.
- Do not make export call V1 or V2 directly.
- Do not change current one-page monthly presensi expectation.
- Do not break signature support.
- Do not break selected column settings.
- Do not break attendance annotations/events.

## TASK
Implement or spec canonical export integration.

Suggested files:
```txt
apps/frontend/src/features/attendance/export/attendanceExportCanonical.types.ts
apps/frontend/src/features/attendance/export/attendanceExport.adapter.ts
apps/frontend/src/features/attendance/export/attendanceExport.validation.ts
apps/frontend/src/features/attendance/export/attendanceExportLegacyBridge.ts
apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts
```

## REQUIRED ADAPTER BEHAVIOR
Canonical dataset → legacy export payload must preserve:
- class identity
- student order
- day columns
- status symbols
- holiday/event annotations
- notes
- summary counts
- percentage row
- selected columns
- signature block
- paper size
- typography/layout settings
- debug trace compatibility

## EXPORT FORMATS TO VALIDATE
- PDF
- Excel
- PNG HD
- PNG 4K
- batch/ZIP if present
- monthly recap
- daily recap
- CSV if introduced in plan

## GOLDEN TEST STRATEGY
Create golden checks for current V1 export shape:
- same column count
- same status counts
- same summary values
- same day header semantics
- same month/year title semantics
- same signature block presence/absence
- same filename format if currently defined

Where binary comparison is too fragile, compare structured export payload before rendering.

## ENGINE-AGNOSTIC RULE
Export may accept only:
```txt
Canonical Attendance Dataset
Canonical Export Dataset
Export UI Settings
Signature Settings
Document Style Settings
```
Export must not accept:
```txt
V1 hook output directly
V2 engine output directly
engine flags in export payload
Supabase client
runtime switch internals
```

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/export/EXPORT_ADAPTER_IMPLEMENTATION.md`
- `attendance/export/EXPORT_GOLDEN_TEST_PLAN.md`
- `attendance/export/EXPORT_BACKWARD_COMPATIBILITY_REPORT.md`
- `attendance/export/EXPORT_ENGINE_AGNOSTIC_PROOF.md`

## ACCEPTANCE CRITERIA
Phase 09 passes only if:
- Export adapter exists or is precisely specified.
- Existing output format is preserved.
- Engine source does not leak.
- V1 export still works.
- V2 can eventually export through canonical model.
- Tests/specs cover all export formats.

## STOP CONDITIONS
Stop if:
- Export layout must be rewritten.
- PDF/Excel structures differ unexpectedly.
- Canonical model lacks required export data.
- Engine-specific fields are needed in normal export.

## FINAL RESPONSE
Return:
- Export files added/updated.
- Compatibility status per format.
- Golden test status.
- Known gaps.
- Whether Phase 10 Testing can start.
