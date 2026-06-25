# RUNTIME ROLLBACK NOTES: Attendance V2

This document describes procedures to force rollback to V1 legacy operations under various environments.

## Rollback Procedures

### 1. Developer / Sandbox Sandbox
- Clear the LocalStorage override or force it to V1:
  ```javascript
  localStorage.setItem("attendance_engine_override", "v1");
  ```
  Or remove it entirely:
  ```javascript
  localStorage.removeItem("attendance_engine_override");
  ```

### 2. Environment Rollback
- Revert environment variables to default:
  ```env
  VITE_ATTENDANCE_ENGINE="v1"
  ```
  Redeploying or reloading the client application will instantly pick up the changed fallback configuration.
