# POST-CUTOVER MONITORING
**Phase 12 — Shadow Mode Monitoring Checklist**
**Date:** 2026-06-28
**Monitoring Period:** First 30 days post shadow mode activation
**Mode:** `SHADOW_ONLY` — V2 runs in parallel, V1 serves all output

---

## Monitoring Overview

Shadow mode does not affect any user-visible behavior. The monitoring objective is to:
1. Confirm V2 produces correct results compared to V1 for real school data
2. Detect any unexpected errors or performance impact
3. Build confidence for the next promoted cutover mode

---

## Monitoring Checklist

### DAILY (First 7 Days)

| Check | How | Pass Criterion | Owner |
|-------|-----|----------------|-------|
| V2 shadow errors in browser console | Open DevTools → Console on `/attendance` page | 0 V2-related unhandled errors | Developer |
| Attendance page load time | DevTools → Network → filter `attendance` | < 3s DOMContentLoaded on 4G sim | Developer |
| Export output intact | Generate PDF/Excel for 1 class | Totals match expected (H+S+I+A+D = active days) | Admin/Teacher |
| Attendance write success | Enter attendance for 1 class | All saves succeed, no error toast | Teacher |
| Lock functionality works | Lock a month and try to write | Write rejected correctly | Admin |

### WEEKLY (Weeks 2–4)

| Check | How | Pass Criterion | Owner |
|-------|-----|----------------|-------|
| Shadow mismatch rate | Read `ShadowComparisonReport` log (if instrumentated) | < 1% mismatch across all shadow runs | Developer |
| V2 calendar accuracy | Compare V2 effective days vs manual calendar | 0 wrong effective day classifications | Developer |
| Rule engine correctness | Check V2 status outputs vs V1 for 3 random classes | Status codes match for all non-override days | Developer |
| Import/OCR still works | Import a sample attendance file | Data appears correctly in V1 (V2 not involved) | Admin |
| Locked month export | Export a locked month | Export generates correctly, no lock interference | Admin |

### EVENT-TRIGGERED (Anytime)

| Trigger | Check | Action |
|---------|-------|--------|
| Teacher reports wrong attendance display | Verify V1 data in Supabase is unchanged | If wrong: rollback; if V1 correct: V2 shadow issue |
| Export PDF shows empty or wrong cells | Verify V1 export path is unchanged | If V1 export broken: investigate separately from V2 |
| Console shows V2 engine crash | Read error stack | Immediate: rollback; then investigate |
| Shadow mismatch > 5% for any month | Review `ShadowComparisonReport` details | Investigate root cause; rollback if unexplained |
| User reports attendance data changed | Check Supabase `attendance_records` table | V2 shadow mode cannot write — check V1 hooks |

---

## Shadow Comparison Metrics to Track

When shadow comparison is run (either in test context or instrumented shadow run):

```typescript
// Expected outputs from compareWithV1CanonicalResult:
{
  match: boolean,          // Target: true for > 99% of runs
  mismatchCount: number,   // Target: 0 per class per day
  mismatches: [{
    studentId: string,
    date: string,
    v1Status: ...,         // Source of truth
    v2Status: ...,         // Must match v1Status
    mismatchFields: [...]  // "status" | "record_missing_in_v2" | "record_missing_in_v1" | "record_order"
  }]
}
```

**Acceptable mismatch types in shadow mode:**
- `record_order` drift on records with same student/date/status — OK (ordering is stable in canonical)
- Missing records in V2 for months not yet loaded through V2 path — OK (V2 is not the read source)

**Unacceptable mismatch types:**
- `status` mismatch for any record V2 has computed — NOT OK, investigate
- `record_missing_in_v2` for records that V2 should have seen — Investigate

---

## Error Tracking

### V2-Specific Errors to Monitor

| Error Code | Meaning | Action |
|------------|---------|--------|
| `WRITE_DISALLOWED_STORAGE` | V2 write path blocked (expected in shadow) | Normal — no action |
| `MISSING_CALENDAR_CONTEXT` | V2 cannot resolve a calendar day | Investigate calendar config |
| `NON_EFFECTIVE_DAY` | V2 rejects write on non-school day | Normal — validate matches V1 logic |
| `LOCKED_WRITE_ATTEMPT` | V2 rejects write on locked month | Normal — validate matches V1 lock |
| `INVALID_STATUS_CODE` | Unregistered status code in V2 | Investigate — may indicate V1 custom status not registered in V2 |
| `DUPLICATE_STUDENT_DATE_RECORD` | Two records for same student/date | High priority — investigate data integrity |
| `MISSING_STUDENT_REFERENCE` | Record references student not in class | Investigate class/student sync |
| `CLASS_SCOPE_MISMATCH` | Record's classId doesn't match dataset | High priority — investigate scope handling |

### Performance Thresholds

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|--------------------|
| Attendance page DOMContentLoaded | > 2s | > 5s |
| Monthly summary computation | > 100ms | > 500ms |
| Export bridge conversion | > 200ms | > 1000ms |
| Shadow comparison (per month) | > 50ms | > 200ms |

---

## Promotion Criteria from Shadow → Class Rollout

Shadow mode may be promoted to `CLASS_ROLLOUT` ONLY when all of these are true:

- [ ] Shadow mode ran for ≥ 30 continuous days in production
- [ ] Shadow mismatch rate ≤ 0.5% across all observed classes
- [ ] 0 unhandled V2 errors in production console
- [ ] BLOCKER-1 resolved: PDF/PNG renderer fixture or Playwright visual guard added
- [ ] BLOCKER-2 resolved: Playwright E2E suite for `/attendance` route exists
- [ ] Canonical export bridge wired to export studio with feature flag
- [ ] Explicit approval from school admin/system owner

---

## Monitoring Contacts

| Role | Contact | Escalation Trigger |
|------|---------|-------------------|
| Developer | System repository owner | Any Critical error |
| School Admin | Via school admin panel | Export failure, data display error |
| System Owner | Direct contact | Security, data loss, Critical production bug |

---

## Rollback Trigger Reference

> See `ROLLBACK_RUNBOOK.md` for complete rollback steps.

**Rollback immediately if:**
- Attendance page crashes for any user
- Export produces wrong data
- Any attendance record is corrupted in Supabase (check V1 path — V2 shadow cannot write)

**Rollback within 4 hours if:**
- Shadow mismatch > 5% unexplained
- V2 engine throwing unhandled errors in console
- Performance degradation > 20%
