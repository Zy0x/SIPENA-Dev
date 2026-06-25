# DISCOVERY DATABASE TOUCHPOINTS: Attendance V1

## Objective
Identify all database touchpoints, queries, mutations, parameters, columns, and indexes used by the legacy Attendance V1 system.

## Evidence from Actual Repo Files
From `apps/frontend/src/hooks/useAttendance.ts`, we see direct calls to:
1. `attendance_records` table:
   - Select: `id`, `class_id`, `student_id`, `date`, `status`, `note`
   - Insert/Update: `class_id`, `student_id`, `date`, `status`, `note`, `user_id`
   - Delete: by `id` or by `class_id` + `date`
2. `attendance_holidays` table:
   - Select: `id`, `user_id`, `date`, `description`
   - Insert: `user_id`, `date`, `description`
   - Delete: by `id`
3. `attendance_day_events` table:
   - Select: `id`, `user_id`, `date`, `label`, `description`, `color`
   - Insert/Update: `user_id`, `date`, `label`, `description`, `color`
   - Delete: by `user_id` + `date`
4. `attendance_locks` table:
   - Select: `id`, `class_id`, `user_id`, `month`, `is_locked`, `locked_at`, `locked_by`
   - Insert/Update: `class_id`, `user_id`, `month`, `is_locked`, `locked_at`, `locked_by`

## Findings
- **Real Schema**:
  - The attendance records map a student (`student_id`) to a class (`class_id`) and a specific date (`date`) with status (`status`) and optional text note (`note`).
  - Row Level Security (RLS) policies are active based on `user_id` matching `auth.uid()`.

## Risks
- **Direct Mutating Calls**: Mutations are performed directly from the client application hook (`useAttendance.ts`). The database contains no validation constraints other than standard foreign keys.
- **Race Conditions**: Parallel inserts or bulk updates delete existing records on the same day before inserting new ones. This is susceptible to brief partial states.

## Safe Next Action
- The V2 engine must perform mutations through a validation gate or service layer. During V2 development, no existing table structure or RLS policy should be changed.
