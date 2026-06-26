# V2 Audit Trail Specification

## Purpose

Every mutating action in V2 (CREATE, UPDATE) must produce a structured audit event. Audit events capture who did what, when, what changed, and what rule drove the decision.

---

## Audit Event Shape

```ts
interface AttendanceAuditEventCanonical {
  id: string;              // Unique event ID: "aud-{nanoid}"
  actor: string;           // User ID or system agent label
  action: "CREATE" | "UPDATE" | "DELETE";
  classId: string;
  studentId: string;
  date: string;            // ISO date "YYYY-MM-DD"
  timestamp: string;       // ISO datetime string
  before: AttendanceRecordCanonical | null;  // Previous record (null on CREATE)
  after: AttendanceRecordCanonical | null;   // Updated record (null on DELETE)
  reasonCode: string;      // Rule engine reason code for this action
  metadata?: Record<string, unknown>;  // Optional extra context (e.g. shadowClash)
}
```

---

## Audit Factory Function

File: `attendanceV2.audit.ts`

```ts
createAuditEvent(
  actor: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  classId: string,
  studentId: string,
  date: string,
  before: AttendanceRecordCanonical | null,
  after: AttendanceRecordCanonical | null,
  reasonCode: string
): AttendanceAuditEventCanonical
```

---

## When Audit Events Are Created

| Trigger | Action | Before | After |
|---|---|---|---|
| New record created | CREATE | null | new record |
| Existing record updated | UPDATE | old record | new record |
| Record deleted | DELETE | old record | null |

---

## Storage

- Audit events are stored in-memory on the `AttendanceV2Service` instance.
- Retrieved via `service.getAuditLogs()`.
- V2 does not persist audit logs to Supabase in this phase (Phase 06).
- Persistence will be handled in Phase 07 (Backend integration).

---

## Shadow Clash Annotation

If shadow mode is active and a V1/V2 mismatch is detected, the audit event's `metadata.shadowClash` field is populated with mismatch details:

```ts
auditEvent.metadata = {
  shadowClash: [
    { studentId, date, v1Status, v2Status, field }
  ]
}
```

---

## Security Notes

- Audit events must never be exposed to frontend without role-based authorization.
- Audit logs must not contain raw secrets or sensitive credentials.
- In production, audit events must be append-only (no mutation after creation).
