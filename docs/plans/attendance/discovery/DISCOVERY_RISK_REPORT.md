# DISCOVERY RISK REPORT: Attendance V1

## Objective
Evaluate all risks associated with building V2, switching runtimes, and migrating data.

## Evidence from Actual Repo Files
- **Page Layout**: `Attendance.tsx` has tightly coupled views (daily list and monthly grid) that directly use returned values of `useAttendance.ts`.
- **Export Formats**: jsPDF drawing in `attendancePdfExport.ts` depends on coordinates and sizing computed directly from print layout models.

## Risk Matrix

| Risk ID | Description | Severity | Mitigation Strategy |
|---|---|---|---|
| R-001 | Modifying V1 page layout breaks stable legacy UI | **BLOCKER** | Do not touch V1 page files. Wrap V1 Hook/UI under a seam. |
| R-002 | Export layout rendering issues due to shape changes | **HIGH** | Use a strict Canonical Model that matches V1 structures. |
| R-003 | RLS policy or direct database write failures in V2 | **HIGH** | Build a shadow mode to validate V2 writes against V1 writes. |
| R-004 | Local storage conflicts for day settings | **MEDIUM** | Use unique prefix settings for V2 configurations. |

## Safe Next Action
- Build the **Runtime Switch** first in Phase 01 to allow absolute isolation between V1 and V2 engines.
