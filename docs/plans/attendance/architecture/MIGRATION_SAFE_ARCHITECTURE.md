# MIGRATION SAFE ARCHITECTURE: Attendance V2

This document details the strategy for safe incremental migration using **Shadow Mode** double-writes to validate V2 database records and behavior in production without risk.

---

## 1. Shadow Mode Execution Flow

In shadow mode, the client application executes updates through a validation proxy:

```txt
               Update Request
                      ↓
         [Runtime Switch (V1 Active)]
                      ↓
            [Execute write to V1] (Updates production DB)
                      ↓
      [Asynchronously execute V2 write] (Shadow write)
                      ↓
       [Compare V1 and V2 outputs]
                      ├─────────────────────────┐
                      ↓                         ↓
                 (Match)                     (Mismatch)
                      ↓                         ↓
              [Log Success]                 [Log Mismatch Alert]
                                            (Telemetry details)
```

---

## 2. Validation Engine Rules
- **No Production Interruption**: Shadow write exceptions must be caught and logged. They must **never** fail the primary V1 write transaction or affect the user interface.
- **Verification Metrics**: Mismatches are audited based on status code matching, note text verification, and timestamp offsets.
- **Telemetry logging**: Mismatches are saved in a temporary telemetry table or local diagnostics log to help the development team identify bugs in the V2 engine.
