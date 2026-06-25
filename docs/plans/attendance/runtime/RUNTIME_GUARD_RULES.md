# RUNTIME GUARD RULES: Attendance V2

This document details the safety rules enforced by `attendanceRuntimeGuard.ts`.

## Safety Guard Constraints
1. **Invalid Config Check**:
   - If the resolved configuration returns an engine that is neither `"v1"` nor `"v2"`, the guard marks the result as unsafe (`isSafe: false`) and overrides the active engine to `"v1"`.

2. **Implementation Check**:
   - In Phase 01, V2 is not implemented (`IS_V2_IMPLEMENTED = false`).
   - If `v2` is selected via environment or local storage override, the guard intercepts execution, overrides it to `"v1"`, and prints a warning in development mode console.

3. **Production Isolation**:
   - The UI page only communicates with the switch hook, ensuring V2 experiments cannot leak to production screens without passing the guard layer first.
