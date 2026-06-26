# CONFLICT ENGINE SPECIFICATION: Attendance V2

Handles clashes when multiple rules of identical priority trigger on the same date context.

## Priority Hierarchy
1. **`HARD_BLOCK`** (Rejects invalid statuses/data instantly)
2. **`LOCK`** (Period locks / Non-effective days)
3. **`MANUAL_OVERRIDE`** (Explicit student suspension or manual adjustment)
4. **`SPECIFIC_POLICY`** (Class/student policy rules)
5. **`EVENT`** (Calendar events)
6. **`DEFAULT`** (Standard defaults)

## Specificity Weights
In case of status clashing at the highest matching priority level, the resolver compares scopes:
- **`student`**: weight 3
- **`class`**: weight 2
- **`school`**: weight 1
- **`other`**: weight 0

## Clashing Output
If specificity is identical but status outputs differ, a warning `RULE_CLASH_WARNING` is appended to conflict notes, and the first rule is applied.
