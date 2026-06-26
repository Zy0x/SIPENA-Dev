# V2 MUTATION SAFETY PRINCIPLES

Strict constraints guarding all write operations in Attendance V2.

## Mutation Security Checklist

1. **Storage Authorization**:
   - `isWriteEnabled` flag must be explicitly configured as true in the orchestrator service instance. If false, writes are rejected with `WRITE_DISALLOWED_STORAGE`.
2. **Student Scope Verification**:
   - The targeted `studentId` must match a student registered within the classes canonical list inside the loaded dataset.
3. **Calendar effective Day Restriction**:
   - Rejects write attempts on non-effective dates (weekends/holidays) unless a higher priority class/school event override has made the date effective.
4. **Administrative Period Lock Enforcement**:
   - Rejects write attempts on dates falling in write-locked months/periods.
5. **Registered Status Constraint**:
   - Status codes must be registered in the status engine. Unregistered codes are rejected immediately.
