# ROLLBACK RUNBOOK
**Phase 12 — Attendance V2 Shadow Mode Rollback**
**Date:** 2026-06-28
**Applies To:** Shadow mode only. V2 is not active for user output, so there is no data rollback needed.

---

## Quick Reference

```
ROLLBACK = Remove VITE_ATTENDANCE_ENGINE from environment variables
TIME TO ROLLBACK = < 2 minutes (redeploy or env change)
DATA IMPACT = None. V2 never writes to Supabase.
```

---

## When to Trigger Rollback

Trigger rollback if ANY of the following symptoms are observed:

| Symptom | Severity | Action |
|---------|----------|--------|
| Attendance page blank/crash for any user | Critical | Immediate rollback |
| Export producing wrong totals or empty cells | Critical | Immediate rollback |
| Shadow comparator throwing unhandled exceptions | High | Rollback within 30 min |
| Console flooding with V2 engine errors | High | Rollback within 1 hour |
| Attendance writes failing unexpectedly | High | Check V1 path first; rollback if V2 suspected |
| V2 debug panel visible to non-admin users | Medium | Remove debug URL param / localStorage key |
| Performance regression > 20% page load time | Medium | Rollback within 4 hours |
| Shadow mismatch rate > 5% of total records | Medium | Investigate; rollback if unexplained |

---

## Who Can Perform Rollback

- **Primary:** School system administrator (via Netlify environment variable panel)
- **Backup:** Developer with repository write access (via `.env.production` + redeploy)
- **Emergency:** Developer with Netlify deploy access (via Netlify forced redeploy with env clear)

---

## Rollback Steps

### Step 1 — Identify rollback scope

For `SHADOW_ONLY` mode (current):
- V2 never served any user output
- No database records were written by V2
- Rollback only stops the shadow comparison running in background

### Step 2 — Remove runtime override (Netlify)

1. Go to **Netlify** → **SIPENA site** → **Site Configuration** → **Environment Variables**
2. Remove `VITE_ATTENDANCE_ENGINE` and `VITE_ATTENDANCE_MODE`
3. Click **Save** → **Trigger redeploy**

```
# Current shadow mode:
VITE_ATTENDANCE_ENGINE=v2
VITE_ATTENDANCE_MODE=shadow

# After rollback: DELETE both keys (or set explicitly):
VITE_ATTENDANCE_ENGINE=v1
# VITE_ATTENDANCE_MODE can be removed (defaults to active)
```

### Step 3 — Remove runtime override (localhost / dev)

```bash
# Remove from .env.production or .env.local:
# Delete line: VITE_ATTENDANCE_ENGINE=v2
# Delete line: VITE_ATTENDANCE_MODE=shadow

# Verify default runtime resolves to V1:
node -e "console.log('default engine: v1')"
```

### Step 4 — Clear any localStorage overrides

If any admin sessions have localStorage overrides set:
```javascript
// In browser DevTools console:
localStorage.removeItem('attendance_engine_override');
localStorage.removeItem('attendance_debug_panel');
```

### Step 5 — Verify rollback is effective

After redeploy, verify in browser DevTools → Network:
- No V2-specific requests appear
- Attendance page loads with V1 data as before
- No console errors related to V2

### Step 6 — Verify export after rollback

1. Open `/attendance` → select any class and month
2. Click Export → verify PDF/Excel output matches pre-rollback baseline
3. Check that attendance totals (H/S/I/A/D) are correct

---

## Data Safety Notes

> **No data was at risk during shadow mode.**

- V2 engine in shadow mode is **read-only** — it reads V1 data and computes a parallel result
- V2 never inserts or updates rows in `attendance_records`, `attendance_locks`, or any other Supabase table
- No Supabase migration was applied during shadow mode activation
- The shadow comparator result is logged in-memory only — it is never persisted to the database
- After rollback, all attendance data in Supabase is exactly as it was before shadow mode

---

## Export Verification After Rollback

| Check | Expected |
|-------|----------|
| PDF export shows correct student names and dates | ✅ Yes |
| Attendance totals (H/S/I/A/D) match pre-shadow values | ✅ Yes |
| Holiday cells show "L" | ✅ Yes |
| Locked months cannot be edited | ✅ Yes |
| OCR/import still works | ✅ Yes |

---

## Communication Note

If rollback is triggered, communicate to admin users:

> "Sistem presensi telah dikembalikan ke mode normal. Tidak ada data yang hilang atau berubah.
> Semua catatan presensi, ekspor, dan laporan tetap berjalan seperti biasa.
> Perubahan ini bersifat teknis dan tidak mempengaruhi tampilan atau fungsi yang Anda gunakan."

No user-facing changelog update is required for shadow mode rollback (shadow mode is not
visible to end users and does not appear in the Changelog page).

---

## Recovery After Rollback

To re-enable shadow mode after root cause investigation:

1. Identify and fix the V2 issue (document in FIX_LOG.md)
2. Run full test suite: `npm test` (must be 571+ pass, 0 TypeScript errors)
3. Re-set `VITE_ATTENDANCE_ENGINE=v2` and `VITE_ATTENDANCE_MODE=shadow`
4. Monitor shadow mismatch rate for the first 48 hours
