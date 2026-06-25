# DATABASE MODEL (HYBRID SAFE)

## CORE RULE
V1 database is LOCKED

---

## V1 TABLES (DO NOT MODIFY)
- attendance
- students
- classes
- teachers

---

## V2 EXTENSION TABLES (SAFE ADDITION)

- attendance_events
- attendance_rules
- attendance_calendar
- attendance_audit_logs
- attendance_versions

---

## RULE
- NEVER ALTER V1 TABLE STRUCTURE
- ONLY ADD NEW TABLES FOR V2