# SYSTEM DEFAULT RULES

Standard baseline rules bundled with SIPENA Attendance V2.

## Default Rules Catalog

1. **`rule-invalid-status`**:
   - Scope: status
   - Priority: `HARD_BLOCK`
   - Action: Blocks write if status is not registered in `statusEngine.ts`.
2. **`rule-lock-period`**:
   - Scope: date
   - Priority: `LOCK`
   - Action: Rejects writes if `blockedWriteState` is true (month lock or closure).
3. **`rule-non-effective-day`**:
   - Scope: date
   - Priority: `LOCK`
   - Action: Rejects writes and defaults status to `L` (Libur) if day is non-effective.
4. **`rule-default-school-day`**:
   - Scope: school
   - Priority: `DEFAULT`
   - Action: Assigns `H` (Hadir) on active days when loading empty, or applies proposed editing status.
