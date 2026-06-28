# CUTOVER DECISION
**Phase 12 — Attendance V2 Release Decision**
**Date:** 2026-06-28
**Decision Owner:** Release Manager / Migration Safety Owner

---

## Decision

**CHOSEN CUTOVER MODE: `SHADOW_ONLY`**

**Release Decision: CONDITIONAL GO**

> V2 runs in parallel with V1. V1 remains the exclusive source of truth for all user-visible
> output, writes, and exports. V2 shadow output is logged for comparison only. No user impact.

---

## Rationale

### Why NOT `NO_CUTOVER`
All 14 acceptance gates have been evaluated. 12/14 pass without condition.
The remaining 2 (signature render parity, browser E2E) are deferred with
documented acceptance, not blocking gate failures. The engine is ready for shadow observation.

### Why NOT `DEBUG_ONLY`
Debug mode only allows admin/debug user visibility, but does not generate
the shadow comparison data needed to confirm V1/V2 parity in a real school context.
`SHADOW_ONLY` is the next safer step that produces real comparison telemetry.

### Why NOT `CLASS_ROLLOUT` or higher
Two HIGH deferred gates block class-level activation:
1. **Binary PDF/PNG parity** — canonical export bridge not wired to live renderer
2. **Browser/E2E regression suite** — no Playwright harness exists yet

These are **hard prerequisites** for any mode where V2 affects user output.

### Why `SHADOW_ONLY` is Safe
- V2 does not write to Supabase (V2 has no persistence wiring in current state)
- V2 does not modify any V1 UI, hook, export renderer, or OCR path
- Shadow comparator is read-only and produces structured `ShadowComparisonReport`
- Rollback to `NO_CUTOVER` requires only removing `VITE_ATTENDANCE_ENGINE`

---

## Runtime Config Change

### BEFORE (current production)
```
VITE_ATTENDANCE_ENGINE=    (not set — defaults to v1/active)
```
Runtime resolves: `{ engine: "v1", mode: "active", source: "default" }`

### AFTER (shadow mode activation)
```
VITE_ATTENDANCE_ENGINE=v2
VITE_ATTENDANCE_MODE=shadow
```
Runtime resolves: `{ engine: "v2", mode: "shadow", source: "env" }`

> **IMPORTANT:** Shadow mode means V2 runs calculations and logs mismatches,
> but V1 remains the source of truth for all renders and data writes.
> The `AttendanceRuntimeBoundary` will show V1 output to all users.

---

## Runtime Config Key Reference

| Key | Value | Effect |
|-----|-------|--------|
| `VITE_ATTENDANCE_ENGINE` | *(unset)* | V1 active (production default) |
| `VITE_ATTENDANCE_ENGINE` | `v1` | V1 active (explicit) |
| `VITE_ATTENDANCE_ENGINE` | `v2` | V2 path (shadow or active based on mode) |
| `VITE_ATTENDANCE_MODE` | `shadow` | V2 runs in parallel, V1 serves output |
| `VITE_ATTENDANCE_MODE` | `active` | V2 serves output (do NOT use until class rollout gates pass) |
| `localStorage.attendance_engine_override` | `v1` or `v2` | Per-browser override (admin/debug only) |
| `?attendanceDebug=1` | *(URL param)* | Show debug panel (admin only, no user impact) |

---

## Prerequisites for Next Cutover Promotion

### To promote to `CLASS_ROLLOUT`:
1. ✅ Resolve BLOCKER-1: Add PDF/PNG renderer fixture or Playwright PDF visual test
2. ✅ Resolve BLOCKER-2: Add Playwright E2E for `/attendance` route, import, and export
3. ✅ Wire canonical export bridge to live export studio behind feature flag
4. ✅ Run shadow mode for ≥1 complete attendance month in production
5. ✅ Confirm shadow mismatch rate < 0.5% across all enrolled classes

### To promote to `SCHOOL_ROLLOUT`:
1. All CLASS_ROLLOUT prerequisites complete
2. ≥3 classes validated in class rollout mode
3. Export output verified by school admin

### To promote to `FULL_ROLLOUT`:
1. All SCHOOL_ROLLOUT prerequisites complete
2. Backend packaging blocker resolved
3. Zero critical export regression reported

---

## Non-Goals for This Decision

- This decision does NOT change any V1 page, hook, export renderer, or Supabase schema.
- This decision does NOT activate V2 writes to any database.
- This decision does NOT affect OCR, import, Excel, PDF, or PNG output paths.
- This decision does NOT change any user-visible UI.
