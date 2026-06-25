# CALENDAR CONFLICT PRIORITY MATRIX

Priority guidelines for resolving conflicting rules on any given date.

## Conflict Stack

The Calendar Engine processes rules in a top-down priority order:

| Priority | Level Name | Description | Conflict Behavior |
| :--- | :--- | :--- | :--- |
| **1** | `LOCK_OR_CLOSURE` | Period lock or school-wide closure | Date becomes non-effective and write-blocked. Overrides all other events. |
| **2** | `SCHOOL_OVERRIDE` | Explicit administrative changes | Forced effective or forced holiday overrides calendar setups. |
| **3** | `CLASS_EVENT` | Class-specific events (e.g. Study Tour) | Takes precedence over school events and standard holidays. |
| **4** | `HOLIDAY` | Registered national or custom holidays | Normally non-effective unless class/school events are scheduled. |
| **5** | `WEEKEND_RULE` | Sunday/Saturday weekend configurations | Depends on 5days vs 6days format. |
| **6** | `DEFAULT_WEEKDAY` | Normal school days | Effective day by default. |
