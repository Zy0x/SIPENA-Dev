<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE -1 — DISCOVERY PROMPT

## PHASE
Discovery only. No implementation. No file mutation unless the user explicitly asks for documentation output.

## ROLE
You are a senior software architect, migration strategist, and codebase forensics analyst for SIPENA Attendance.
Your task is to understand the existing V1 Presensi system deeply before any implementation begins.

## CONTEXT YOU MUST LOAD FIRST
Read and obey these documents in this exact order:
1. `attendance/01_MANIFEST.md`
2. `attendance/02_AI_CONTRACT.md`
3. `attendance/03_RUNTIME_SWITCH.md`
4. `attendance/project-memory/PROJECT_CONTEXT.md`
5. `attendance/project-memory/PROJECT_STATE.md`
6. `attendance/project-memory/CURRENT_PHASE.md`
7. `attendance/project-memory/DECISIONS.md`
8. `attendance/project-memory/NEXT_ACTION.md`
9. `attendance/engines/V1_LOCKED.md`
10. `attendance/export/STUDIO_EXPORT_COMPATIBILITY.md`

If there is an `AGENTS.md` in the repo, read it first and let it override every instruction here.

## REPO-SPECIFIC TARGETS
Analyze the current SIPENA repo structure, especially:
- `package.json`
- `apps/frontend/src/pages/Attendance.tsx`
- `apps/frontend/src/hooks/useAttendance.ts`
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx`
- `apps/frontend/src/components/import/OCRImportDialog.tsx`
- `apps/frontend/src/components/export/UnifiedExportStudio*`
- `apps/frontend/src/components/export/AttendanceExportPreviewV2*`
- `apps/frontend/src/components/attendance/*`
- `apps/frontend/src/lib/attendanceExport*`
- `apps/frontend/src/lib/attendancePrintLayout*`
- `apps/frontend/src/lib/attendancePdfExport*`
- `apps/frontend/src/lib/attendanceExportDebug*`
- `apps/frontend/src/lib/reportExportLayout*`
- `apps/backend/src/modules/*`
- `supabase/**`

## HARD RULES
- Do not write production code.
- Do not refactor `Attendance.tsx`.
- Do not modify `useAttendance.ts`.
- Do not modify export, import, OCR, or database schema.
- Do not assume table names from the plan are exact; verify actual Supabase usage in the repo.
- Treat V1 as a black box unless mapping/documentation is required.
- If a file is minified, line-compressed, or huge, analyze by symbols, imports, functions, state names, DB calls, and export calls.

## TASK
Perform a forensic discovery of Attendance V1 and produce a precise technical map.

You must identify:
1. V1 entry points.
2. V1 UI responsibilities.
3. V1 hook responsibilities.
4. V1 Supabase tables actually used.
5. Attendance status model currently used.
6. Calendar and holiday behavior.
7. Day event behavior.
8. Lock behavior.
9. Import and OCR flow.
10. Export flow and export coupling points.
11. Backend readiness or backend absence for attendance.
12. Direct DB dependencies.
13. Local storage dependencies.
14. Runtime switch absence/presence.
15. High-risk functions and files.
16. Low-risk extension points.
17. Minimum safe adapter seam for V1.
18. Documents that must be created before coding.

## EXPECTED OUTPUT FILES
Create or update documentation only under `attendance/discovery/` or `docs/plan/attendance/discovery/`:
- `DISCOVERY_SYSTEM_MAP.md`
- `DISCOVERY_DEPENDENCY_GRAPH.md`
- `DISCOVERY_EXPORT_COUPLING_MAP.md`
- `DISCOVERY_DATABASE_TOUCHPOINTS.md`
- `DISCOVERY_RISK_REPORT.md`
- `V1_TO_CANONICAL_SEAM.md`
- `PHASE_-1_COMPLETION_REPORT.md`

If these folders do not exist, create them. Do not modify app code.

## OUTPUT FORMAT REQUIREMENTS
Every discovery document must include:
- Objective
- Evidence from actual repo files
- Findings
- Risks
- Safe next action
- Blockers

For dependency graph, include Mermaid diagrams where useful.

## RISK CLASSIFICATION
Classify every risk as:
- `BLOCKER`: must be resolved before runtime or V2 work.
- `HIGH`: likely to break V1, export, or data.
- `MEDIUM`: may cause mismatch or future migration issue.
- `LOW`: documentation or clean-up concern.

## ACCEPTANCE CRITERIA
This phase is complete only when:
- No production code was changed.
- All V1 attendance touchpoints are mapped.
- Actual repo table names are documented.
- Export coupling is documented.
- A safe V1 adapter seam is identified.
- The next phase can start without guessing.

## STOP CONDITIONS
Stop and report instead of coding if:
- You cannot determine real V1 database tables.
- You cannot locate the current attendance page/hook.
- Export pipeline is too coupled to map safely.
- Any instruction asks you to modify V1 during this phase.

## FINAL RESPONSE
Summarize:
- What was mapped.
- Which files were inspected.
- Which risks block implementation.
- Whether Phase -1 passed or failed.
- Exact next phase recommendation.
