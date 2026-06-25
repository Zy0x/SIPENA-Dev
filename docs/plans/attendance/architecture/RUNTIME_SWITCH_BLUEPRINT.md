# RUNTIME SWITCH BLUEPRINT: Attendance V2

This document describes the design and specification of the **Runtime Switch** that toggles execution between V1 and V2 engines dynamically.

---

## 1. Switch Configuration & Registry

The active engine is determined by a system configuration variable `ATTENDANCE_RUNTIME_ENGINE` which can be configured via:
- Environment variable: `VITE_ATTENDANCE_ENGINE="v1 | v2"`
- Database system config: a record in `system_settings` table (if available)
- LocalStorage override: `attendance_engine_override="v1 | v2"` (for developer sandbox testing)

---

## 2. Code Interface (Frontend)

The `AttendanceRuntimeContext` wraps the page and routes the execution:

```typescript
import { useAttendanceV1Adapter } from "../v1/useAttendanceV1Adapter";
import { useAttendanceV2 } from "../v2/hooks/useAttendanceV2";

export interface AttendanceRuntime {
  engine: "v1" | "v2";
  records: CanonicalRecord[];
  holidays: CanonicalHoliday[];
  getDayStats: (date: Date) => Stats;
  setAttendance: (studentId: string, date: Date, status: string | null) => Promise<void>;
  // ... (matches the seam contract)
}

export function useAttendanceRuntime(classId: string, currentMonth: Date, workDayFormat: string): AttendanceRuntime {
  const engine = resolveActiveEngine(); // checks LocalStorage -> Env -> Default (v1)

  const v1 = useAttendanceV1Adapter(classId, currentMonth, workDayFormat, engine === "v1");
  const v2 = useAttendanceV2(classId, currentMonth, workDayFormat, engine === "v2");

  return engine === "v2" ? v2 : v1;
}
```

---

## 3. Failure & Recovery Paths
- **Safe Fallback**: If `useAttendanceV2` throws an initialization error, the runtime context catches it, logs a telemetry warning, and switches fallback state to `v1`.
- **Hot Swap**: Switching engines does not require a database schema migration, because V2 operates in isolation. Switching configuration changes the active code paths instantly.
