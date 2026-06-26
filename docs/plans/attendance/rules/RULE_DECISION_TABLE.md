# RULE DECISION TABLE

Context inputs and rule outcomes.

## Evaluation Decision Matrix

| Date isEffective | Month Locked | Proposed Status | Applied Rule | Outcome Status | Write Allowed | Reason Code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Yes** | No | *Null* | `rule-default-school-day` | **`H`** | Yes | `DEFAULT_WEEKDAY_HADIR` |
| **Yes** | No | **`S`** | `rule-default-school-day` | **`S`** | Yes | `MANUAL_STATUS_ASSIGNMENT` |
| **Yes** | No | **`XYZ`** | `rule-invalid-status` | — | No | `INVALID_STATUS_CODE` |
| **Yes** | **Yes** | **`H`** | `rule-lock-period` | **`H`** / Prev | No | `LOCKED_PERIOD` |
| **No** | No | **`H`** | `rule-non-effective-day` | **`L`** | No | `NON_EFFECTIVE_DAY` |
| **Yes** | No | **`H`** *(Suspended)* | `rule-student-suspension` | **`A`** | No | `STUDENT_SUSPENDED` |
