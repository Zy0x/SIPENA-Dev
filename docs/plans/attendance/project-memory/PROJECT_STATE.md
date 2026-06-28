# PROJECT STATE
**Attendance V2 — Current System State**
**Last Updated:** 2026-06-28
**Phase:** 12 — COMPLETE (Shadow Mode Activation)

---

## Current Runtime State

| Property | Value |
|----------|-------|
| **Active Engine** | V1 (source of truth for all users) |
| **V2 Engine State** | Shadow mode — runs in parallel, no user output |
| **Default config** | `{ engine: "v1", mode: "active", source: "default" }` |
| **Shadow config** | `VITE_ATTENDANCE_ENGINE=v2` + `VITE_ATTENDANCE_MODE=shadow` |
| **Database writes** | V1 only (V2 has no Supabase persistence wiring) |
| **Export path** | V1 (canonical bridge built, not wired to renderer) |
| **Rollback time** | < 2 minutes (env var removal + redeploy) |

---

## Phase Completion Summary

| Phase | Name | Status |
|-------|------|--------|
| 00 | Architecture Design | ✅ Complete |
| 01 | Runtime Switch | ✅ Complete |
| 02 | V1 Clone/Wrap | ✅ Complete |
| 03 | Canonical Model | ✅ Complete |
| 04 | Calendar Engine | ✅ Complete |
| 05 | Rule Engine | ✅ Complete |
| 06 | Core V2 Assembly | ✅ Complete |
| 07 | Backend Orchestration | ✅ Foundation (packaging blocker) |
| 08 | Frontend Integration | ✅ Foundation |
| 09 | Export Canonical Adapter | ✅ Foundation |
| 10 | Testing Matrix | ✅ Foundation |
| 11 | Fixing / Hardening | ✅ Foundation |
| **12** | **Final Cutover** | **✅ Shadow Mode Chosen** |
| 13 | Playwright + PDF Parity | ⬜ Not started |
| 14 | Class Rollout | ⬜ Blocked (Phase 13 prerequisites) |

---

## Active Blockers (Phase 13 Prerequisites)

| Blocker | Severity | Owner | Status |
|---------|----------|-------|--------|
| PDF/PNG binary signature parity not automated | HIGH | Developer | Deferred to Phase 13 |
| Playwright E2E for `/attendance` route not set up | HIGH | Developer | Deferred to Phase 13 |
| Canonical export bridge not wired to live renderer | HIGH | Developer | Deferred to Phase 13 |
| Backend ESM packaging (node standalone run fails) | MEDIUM | Developer | Deferred to Phase 14 |

---

## Test Baseline

```
Date:          2026-06-28
Test files:    68 passed (68)
Tests:         571 passed (571)
TypeScript:    0 errors
Lint:          0 errors, 401 existing warnings
Build:         PASS
Last commit:   6c8d5fe — fix(attendance): resolve 6 logic bugs in V2 engines
```

---

## Protected Files (Must Never Be Modified Without Explicit Approval)

- `apps/frontend/src/pages/Attendance.tsx`
- `apps/frontend/src/hooks/useAttendance.ts`
- `apps/frontend/src/lib/attendancePrintLayout.ts`
- `apps/frontend/src/lib/attendancePdfExport.ts`
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx`
- `apps/frontend/src/components/import/OCRImportDialog.tsx`
- `supabase/**` (all migrations, schema, RLS policies)

---

## V2 Source Files (Active)

```
apps/frontend/src/features/attendance/
├── canonical/           — Types, mappers, validation (V1/V2 shared)
├── export/              — Canonical export bridge and adapter
├── guards/              — Frontend import boundary guards
├── provider/            — AttendanceProvider, CanonicalProvider
├── runtime/             — Config resolver, types, guard
├── testing/             — Phase 10 test harness
├── ui/                  — Debug panel (opt-in only)
├── v1/                  — V1 canonical adapter (read-only)
└── v2/                  — V2 service, engine, rules, calendar, shadow
    ├── calendar/
    ├── rules/
    ├── attendanceV2.audit.ts
    ├── attendanceV2.engine.ts
    ├── attendanceV2.service.ts
    ├── attendanceV2.shadow.ts
    ├── attendanceV2.test.ts
    ├── attendanceV2.types.ts
    └── attendanceV2.validation.ts
```

---

## Next Actions (Prioritized)

1. **Activate shadow mode** — Set `VITE_ATTENDANCE_ENGINE=v2` + `VITE_ATTENDANCE_MODE=shadow` in Netlify environment
2. **Monitor** — Follow `POST_CUTOVER_MONITORING.md` for first 30 days
3. **Phase 13** — Add Playwright E2E + PDF fixture before promoting to `CLASS_ROLLOUT`
4. **Phase 13** — Wire canonical export bridge to export studio with feature flag
5. **Phase 14** — Resolve backend ESM packaging; activate backend attendance API