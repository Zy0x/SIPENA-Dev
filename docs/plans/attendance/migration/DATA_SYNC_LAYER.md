# DATA SYNC LAYER

## PURPOSE
Mirror V1 data into V2 system safely

---

## FLOW

V1 DB →
   Sync Service →
      V2 Shadow DB →
         Validation Engine

---

## RULE
- read-only from V1
- write only to V2 shadow layer