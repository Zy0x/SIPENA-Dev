# CALENDAR CONFLICT PRIORITY: Attendance V2

## Objective

Define the deterministic conflict stack used when multiple calendar rules apply to the same date.

## Evidence from actual repo files

- `ConflictPriority` is declared in `calendarEngine.types.ts`.
- Conflict evaluation is implemented in `calendarConflictResolver.ts`.
- Edge-case tests are in `calendarEngine.test.ts`.

## Findings

| Priority | Enum | Meaning | Output behavior |
| --- | --- | --- | --- |
| 1 | `LOCK_OR_CLOSURE` | Administrative closure | Non-effective, holiday-like label, write-blocked. |
| 2 | `SCHOOL_OVERRIDE` | Forced effective or forced holiday | Explicitly changes effective/holiday state. |
| 3 | `CLASS_EVENT` | Event scoped to matching class | Effective for that class. |
| 4 | `SCHOOL_EVENT` | School-wide or matching school-scoped event | Effective for matching school scope. |
| 5 | `HOLIDAY` | National or custom holiday record | Non-effective with holiday label. |
| 6 | `WEEKEND_RULE` | Sunday or Saturday in `5days` format | Non-effective. |
| 7 | `DEFAULT_WEEKDAY` | Normal work-day format | Effective. |

### Same-level tie breaking

- Overrides: class-specific first, then highest `priority`, then lowest stable `id`.
- Events: highest `priority`, then lowest stable `id`.
- Holidays: national first, then lowest stable `id`.

### Lock exception

Attendance locks are evaluated in `computeEffectiveDay` after conflict resolution. Locks set write-block state but do not override `isEffective`, because existing records must remain readable.

## Risks

- `HIGH`: Changing enum numbers after backend implementation starts can break shadow-mode comparison reports.
- `MEDIUM`: Adding new event scopes must define tie-breaking before activation.

## Safe next action

Phase 05 can reference this matrix for rule decisions and should not duplicate a separate priority table.

## Blockers

None.
