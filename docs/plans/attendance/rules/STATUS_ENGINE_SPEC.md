# STATUS ENGINE SPEC: Attendance V2

## Objective
Document the status registry used by Attendance V2 rules while preserving V1 status codes and allowing validated future custom statuses.

## Evidence from Actual Repo Files
- Status implementation: `apps/frontend/src/features/attendance/v2/rules/statusEngine.ts`
- Status type: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.types.ts`
- Canonical status allowance: `apps/frontend/src/features/attendance/canonical/canonical.types.ts`
- Tests: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`

## Findings
Default status codes are:

| Code | Label | Counts Present | Counts Absence | Export Code | Flags |
| --- | --- | --- | --- | --- | --- |
| `H` | Hadir | yes | no | `H` | `COUNTS_AS_PRESENT` |
| `I` | Izin | no | yes | `I` | `REQUIRES_NOTE`, `COUNTS_AS_ABSENCE` |
| `S` | Sakit | no | yes | `S` | `REQUIRES_NOTE`, `COUNTS_AS_ABSENCE` |
| `A` | Alpha | no | yes | `A` | `COUNTS_AS_ABSENCE` |
| `D` | Dispensasi | yes | no | `D` | `REQUIRES_NOTE`, `COUNTS_AS_PRESENT` |
| `L` | Libur | no | no | `L` | `READ_ONLY` |
| `-` | Belum Diisi | no | no | `-` | none |

Custom statuses must provide:
- non-empty code and label;
- finite non-negative weight;
- export code;
- color token;
- no simultaneous `countsAsPresent` and `countsAsAbsence`.

The registry exposes:
- `getStatusDefinition(code)`;
- `registerCustomStatus(definition)`;
- `listAllStatuses()`;
- `resetToDefaults()`;
- `countsAsPresent(code)`;
- `countsAsAbsence(code)`;
- `requiresNote(code)`.

## Risks
- `HIGH`: Custom status definitions must be synchronized with backend/export semantics before production activation.
- `MEDIUM`: Export currently remains V1-stable; future custom statuses require explicit export mapping policy.
- `LOW`: Color tokens are strings and not yet validated against a design-token registry.

## Safe Next Action
Phase 06 may use status helpers for validation and summary calculation, but must keep V1 export unchanged until export accepts canonical status contracts.

## Blockers
None for isolated V2 work. Production custom status persistence is not implemented in Phase 05.
