# V1 CANONICAL MAPPING DRAFT: Attendance V2

This document outlines the draft mapping schema between V1 legacy records and the Canonical Attendance Model.

## Mapping Draft Rules

### 1. Attendance Record
```typescript
// From V1 shape:
interface AttendanceRecord {
  id?: string;
  class_id: string;
  student_id: string;
  date: string;
  status: "H" | "I" | "S" | "A" | "D";
  note?: string | null;
}

// To Canonical shape:
interface CanonicalRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  status: "H" | "S" | "I" | "A" | "D" | "L" | "-";
  note: string | null;
}
```

### 2. Properties Translation
- `class_id` maps to `classId`
- `student_id` maps to `studentId`
- `note` (if empty or undefined) coalesces to `null`
- `status` maps directly. If a day is determined to be a holiday, status defaults to `"L"`.
