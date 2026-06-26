# RULE ENGINE SPECIFICATION: Attendance V2

Deterministic and explainable school policy rules evaluation for Attendance V2.

## API Contracts

### RuleEvaluationContext
```typescript
interface RuleEvaluationContext {
  student: AttendanceStudentCanonical;
  classId: string;
  date: string; // YYYY-MM-DD
  proposedStatus: AttendanceStatusCode | null;
  proposedNote: string | null;
  calendarDay: V2CalendarDay;
  locks: AttendanceLockCanonical[];
  existingRecord: AttendanceRecordCanonical | null;
}
```

### AttendanceRule
```typescript
interface AttendanceRule {
  id: string;
  name: string;
  scope: "school" | "class" | "student" | "date" | "status";
  priority: RulePriority;
  enabled: boolean;
  condition: (context: RuleEvaluationContext) => boolean;
  effect: (context: RuleEvaluationContext) => RuleEffect;
}
```

### RuleEvaluationOutput
```typescript
interface RuleEvaluationOutput {
  selectedStatus: AttendanceStatusCode | null;
  writeAllowed: boolean;
  reasonCode: string;
  appliedRuleIds: string[];
  conflictNotes: string[];
  auditMetadata?: Record<string, any>;
}
```
