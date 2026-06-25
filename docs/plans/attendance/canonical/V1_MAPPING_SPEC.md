# V1 MAPPING SPECIFICATION: Attendance V2

This document details mapping translations between the legacy V1 database schemas and the Canonical Model.

## Mapping Definitions

- **Record Translation**:
  - `record.student_id` maps to `canonical.studentId`
  - `record.class_id` maps to `canonical.classId`
  - `record.note || null` maps to `canonical.note`
  - Creation and update timestamps are mapped to `createdAt` and `updatedAt`.
  
- **Holidays & Locks**:
  - `holiday.date` maps to `canonical.date`
  - `lock.is_locked` maps to `canonical.isLocked`
  - Locks apply a month filter comparison `YYYY-MM`.
