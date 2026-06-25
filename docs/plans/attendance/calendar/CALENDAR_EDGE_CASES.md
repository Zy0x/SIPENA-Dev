# CALENDAR EDGE CASES SPECIFICATION

Edge-case scenarios and engine resolutions.

## Edge Cases

1. **Sunday Holiday**:
   - Sunday is normally weekend holiday. If a national holiday is scheduled on Sunday, it is resolved with `ConflictPriority.HOLIDAY` (priority 4) rather than `ConflictPriority.WEEKEND_RULE` (priority 5) to ensure the holiday name labels the day.
2. **Saturday Inactive in 5-day / Active in 6-day**:
   - Saturday in 5-day format resolves to a holiday. In 6-day format, it defaults to a school day.
3. **Event on Holiday**:
   - If an event is scheduled on a holiday, the event priority (class or school event) is higher than the holiday, so the day is marked as effective.
4. **Class-Specific Event vs School-Wide Event**:
   - A class-scoped event takes precedence for that class, resolving conflicts when both apply on the same day.
5. **Month Boundary & Leap Year**:
   - Date range loops use parseISO/addDays to seamlessly step across month boundaries and leap year February (Feb 29).
6. **Locked Date**:
   - If a lock exists for the month, the `blockedWriteState` output is true.
