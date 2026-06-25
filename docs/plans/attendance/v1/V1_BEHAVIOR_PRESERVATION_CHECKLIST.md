# V1 BEHAVIOR PRESERVATION CHECKLIST: Attendance V2

Checklist to verify V1 behavior remains identical after implementing the wrapper seam.

## Verification Checklist

- [ ] Verify that navigating to the `/attendance` page renders the Attendance screen exactly as before.
- [ ] Confirm class selection lists load classes and populate murid tables accurately.
- [ ] Verify status toggle buttons (H, S, I, A, D) successfully trigger Supabase mutations.
- [ ] Verify day events and holiday highlights render on the calendar headers.
- [ ] Confirm monthly lock toggles block edits on locked periods.
- [ ] Verify PDF, Excel, and PNG exports produce byte-stable layout outputs.
- [ ] Ensure `useAttendance.ts` and `Attendance.tsx` remain unmodified in git diff.
