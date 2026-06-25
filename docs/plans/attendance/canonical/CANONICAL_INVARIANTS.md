# CANONICAL INVARIANTS: Attendance V2

Invariants governing the validity of canonical data structures in SIPENA.

## System Invariants

1. **Strict Date Constraint**:
   - Every `date` property MUST match the ISO standard pattern `YYYY-MM-DD`. Non-conforming date strings are rejected.

2. **Reference Integrity**:
   - Records must attach to a valid `studentId` and `classId`. Empty references trigger errors.

3. **Status Code Validity**:
   - Status values must strictly fall within `{"H", "S", "I", "A", "D", "L", "-"}`.

4. **Lock Compliance**:
   - Period locks are read-only. Write attempts on locked class/month periods are rejected.

5. **Leaked Descriptors Guard**:
   - Export models are scrubbed of debug metadata and engine markers, ensuring byte stability in print layouts.
