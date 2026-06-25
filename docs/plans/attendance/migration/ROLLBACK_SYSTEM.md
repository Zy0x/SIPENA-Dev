# ROLLBACK SYSTEM

## PURPOSE
Instant revert to V1 if V2 fails

---

## RULE

Rollback = config switch only

NOT data restore

NOT migration reversal

---

## FLOW

V2 failure →
    runtime_engine = "v1"