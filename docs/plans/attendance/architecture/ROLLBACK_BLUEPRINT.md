# ROLLBACK BLUEPRINT: Attendance V2

This document specifies the rollback procedures and mechanics to immediately restore V1 legacy operations in the event of failure in the V2 engine.

---

## 1. Instant Configuration-Based Rollback

The rollback mechanism does not require deploying new code or migrating database schemas. It relies on changing the runtime engine selector configuration.

- **Mechanics**:
  - Setting `VITE_ATTENDANCE_ENGINE="v1"` or updating the settings key `attendance_runtime_engine` to `"v1"` immediately disables V2 code execution paths.
  - The runtime provider will immediately resolve to `useAttendanceV1Adapter`, reverting page rendering, stats, and database transactions to the legacy V1 implementation.

---

## 2. Dynamic client-side override
- In case of critical backend or API connection failure on V2 paths, the frontend provider context will automatically catch the exception, display a warning toast to the user, and switch the client-side instance to the V1 adapter locally.
- Telemetry logs will report the automatic switch to the audit module.
- Developers can manually override the engine choice in the browser session console:
  `localStorage.setItem('attendance_engine_override', 'v1')` which takes immediate precedence over server configurations.
