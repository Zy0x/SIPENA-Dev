# CANONICAL MODEL BLUEPRINT: Attendance V2

This document defines the single source of truth schemas representing the **Canonical Attendance Model** consumed by UI components, export tools, and reports.

---

## 1. Core Entity Schemas

All types reside in `packages/attendance-contracts/src/canonical.ts` to ensure frontend-backend synchrony.

```typescript
export type CanonicalStatus = "H" | "S" | "I" | "A" | "D" | "L" | "-";

export interface CanonicalRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // Format: YYYY-MM-DD
  status: CanonicalStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalHoliday {
  date: string; // Format: YYYY-MM-DD
  description: string;
  isNational: boolean;
}

export interface CanonicalDayEvent {
  date: string; // Format: YYYY-MM-DD
  label: string;
  description: string | null;
  color: string;
}

export interface CanonicalAttendanceLock {
  classId: string;
  month: string; // Format: YYYY-MM
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
}
```

---

## 2. Standard Mappers

Mappers map legacy database tables to the Canonical Model format:

```typescript
export function mapV1RecordToCanonical(record: any): CanonicalRecord {
  return {
    id: record.id,
    studentId: record.student_id,
    classId: record.class_id,
    date: record.date,
    status: record.status as CanonicalStatus,
    note: record.note || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function mapCanonicalToV1Record(canonical: CanonicalRecord): any {
  return {
    id: canonical.id,
    student_id: canonical.studentId,
    class_id: canonical.classId,
    date: canonical.date,
    status: canonical.status,
    note: canonical.note,
    created_at: canonical.createdAt,
    updated_at: canonical.updatedAt,
  };
}
```
